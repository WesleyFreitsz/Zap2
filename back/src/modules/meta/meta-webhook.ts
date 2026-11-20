import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { IntegrationType, MessageStatus } from "@prisma/client";
import { z } from "zod";

const mediaKindSchema = z.enum(["image", "audio", "video", "document", "sticker"]);
type MediaKind = z.infer<typeof mediaKindSchema>;
export type InboundMedia = {
  kind: MediaKind;
  source: { type: "whatsapp_media_id"; id: string } | { type: "url"; url: string };
  mimeType?: string;
  fileName?: string;
  caption?: string;
};

const mediaPlaceholders: Record<MediaKind, string> = {
  image: "[imagem]",
  audio: "[áudio]",
  video: "[vídeo]",
  document: "[documento]",
  sticker: "[figurinha]",
};

export type InboundMessage = {
  channel: IntegrationType;
  accountId: string;
  contactRemoteId: string;
  contactName?: string;
  externalId: string;
  content: string;
  sentAt: Date;
  media?: InboundMedia;
};

export type MessageEvent = Pick<InboundMessage, "channel" | "accountId"> & (
  | { kind: "status"; externalId: string; status: MessageStatus }
  | { kind: "reaction"; externalId: string; emoji: string | null }
  | { kind: "read"; contactRemoteId: string; watermark: Date }
);

export function verifyWebhookChallenge(query: Record<string, unknown>, token: string): string | undefined {
  const suppliedToken = query["hub.verify_token"];
  const challenge = query["hub.challenge"];
  if (!token || typeof suppliedToken !== "string" || typeof challenge !== "string" || query["hub.mode"] !== "subscribe") {
    return;
  }
  const digest = (value: string) => createHash("sha256").update(value).digest();
  if (timingSafeEqual(digest(suppliedToken), digest(token))) return challenge;
}

export function verifyWebhookSignature(rawBody: Buffer | undefined, signature: string | undefined, secret: string): boolean {
  if (!rawBody || !signature || !secret || !/^sha256=[a-f0-9]{64}$/i.test(signature)) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest();
  return timingSafeEqual(expected, Buffer.from(signature.slice(7), "hex"));
}

const id = z.string().min(1);
const webhookSchema = z.object({ object: z.enum(["whatsapp_business_account", "page", "instagram"]), entry: z.array(z.unknown()) });
const whatsappEntrySchema = z.object({ changes: z.array(z.unknown()) });
const whatsappChangeSchema = z.object({
  field: z.literal("messages"),
  value: z.object({
    metadata: z.object({ phone_number_id: id }),
    contacts: z.array(z.unknown()).default([]),
    messages: z.array(z.unknown()).default([]),
    statuses: z.unknown(),
  }),
});
const whatsappContactSchema = z.object({ wa_id: id.optional(), user_id: id.optional(), profile: z.object({ name: id.optional() }).optional() });
const whatsappMessageSchema = z.object({
  id,
  from: id.optional(),
  from_user_id: id.optional(),
  timestamp: z.string().regex(/^\d+$/),
  type: id,
  text: z.object({ body: id }).optional(),
}).passthrough();
const whatsappMediaSchema = z.object({
  id,
  mime_type: id.optional(),
  filename: id.optional(),
  caption: z.string().optional(),
});
const messagingEntrySchema = z.object({ id, messaging: z.array(z.unknown()) });
const messagingEventSchema = z.object({
  sender: z.object({ id }),
  timestamp: z.number().int().nonnegative(),
  message: z.object({
    mid: id,
    text: id.optional(),
    is_echo: z.boolean().optional(),
    attachments: z.array(z.unknown()).optional(),
  }),
});
const attachmentSchema = z.object({ type: id, payload: z.unknown() });
const attachmentKindSchema = z.enum(["image", "audio", "video", "file"]);
const attachmentPayloadSchema = z.object({ url: id });
const statusByWebhookValue = { sent: "SENT", delivered: "DELIVERED", read: "READ", failed: "FAILED" } as const;
const whatsappStatusesSchema = z.array(z.unknown());
const whatsappStatusSchema = z.object({ id, status: z.enum(["sent", "delivered", "read", "failed"]) });
const whatsappReactionSchema = z.object({
  type: z.literal("reaction"),
  reaction: z.object({ message_id: id, emoji: z.string() }),
});
const messagingUpdateSchema = z.object({ sender: z.unknown(), read: z.unknown(), delivery: z.unknown(), reaction: z.unknown() });
const messagingReadSchema = z.object({ watermark: z.number().int().nonnegative() });
const messagingSeenSchema = z.object({ mid: id });
const messagingDeliverySchema = z.object({ mids: z.array(z.unknown()) });
const messagingReactionSchema = z.discriminatedUnion("action", [
  z.object({ mid: id, action: z.literal("react"), emoji: id }),
  z.object({ mid: id, action: z.literal("unreact") }),
]);

function parseWhatsAppEntry(entry: unknown): InboundMessage[] {
  const result = whatsappEntrySchema.safeParse(entry);
  if (!result.success) return [];

  return result.data.changes.flatMap((change) => {
    const parsed = whatsappChangeSchema.safeParse(change);
    if (!parsed.success) return [];
    const { messages, metadata, contacts } = parsed.data.value;
    const profiles = contacts.flatMap((contact) => {
      const parsedContact = whatsappContactSchema.safeParse(contact);
      return parsedContact.success ? [parsedContact.data] : [];
    });

    return messages.flatMap((message): InboundMessage[] => {
      const parsedMessage = whatsappMessageSchema.safeParse(message);
      if (!parsedMessage.success || parsedMessage.data.type === "reaction") return [];
      const data = parsedMessage.data;
      const contactRemoteId = data.from ?? data.from_user_id;
      const sentAt = new Date(Number(data.timestamp) * 1_000);
      const kind = mediaKindSchema.safeParse(data.type);
      const asset = kind.success ? whatsappMediaSchema.safeParse(data[kind.data]) : undefined;
      const media: InboundMedia | undefined = kind.success && asset?.success ? {
        kind: kind.data,
        source: { type: "whatsapp_media_id", id: asset.data.id },
        mimeType: asset.data.mime_type,
        fileName: asset.data.filename,
        caption: asset.data.caption,
      } : undefined;
      const content = media?.caption || data.text?.body || (
        kind.success ? mediaPlaceholders[kind.data] : data.type !== "text" ? `[${data.type}]` : undefined
      );
      if (!contactRemoteId || !content || Number.isNaN(sentAt.getTime())) return [];
      const contact = profiles.find(({ wa_id, user_id }) => wa_id === contactRemoteId || user_id === contactRemoteId);
      return [{
        channel: "WHATSAPP",
        accountId: metadata.phone_number_id,
        contactRemoteId,
        contactName: contact?.profile?.name,
        externalId: data.id,
        content,
        sentAt,
        ...(media && { media }),
      }];
    });
  });
}

function parseMessagingEntry(entry: unknown, channel: "FACEBOOK" | "INSTAGRAM"): InboundMessage[] {
  const result = messagingEntrySchema.safeParse(entry);
  if (!result.success) return [];

  return result.data.messaging.flatMap((event): InboundMessage[] => {
    const parsed = messagingEventSchema.safeParse(event);
    if (!parsed.success || parsed.data.message.is_echo) return [];
    const { sender, timestamp, message } = parsed.data;
    const sentAt = new Date(timestamp);
    if (Number.isNaN(sentAt.getTime())) return [];
    const attachment = attachmentSchema.safeParse(message.attachments?.[0]);
    const type = attachment.data?.type;
    const kind = attachmentKindSchema.safeParse(type);
    const mediaKind = kind.data === "file" ? "document" : kind.data;
    const payload = attachmentPayloadSchema.safeParse(attachment.data?.payload);
    const media: InboundMedia | undefined = mediaKind && payload.success ? {
      kind: mediaKind,
      source: { type: "url", url: payload.data.url },
    } : undefined;
    return [{
      channel,
      accountId: result.data.id,
      contactRemoteId: sender.id,
      externalId: message.mid,
      content: message.text ?? (mediaKind ? mediaPlaceholders[mediaKind] : `[${type ?? "unsupported"}]`),
      sentAt,
      ...(media && { media }),
    }];
  });
}

export function parseMetaWebhook(payload: unknown): InboundMessage[] {
  const result = webhookSchema.safeParse(payload);
  if (!result.success) return [];
  const { object, entry } = result.data;
  if (object === "whatsapp_business_account") return entry.flatMap(parseWhatsAppEntry);
  const channel = object === "page" ? "FACEBOOK" : "INSTAGRAM";
  return entry.flatMap((item) => parseMessagingEntry(item, channel));
}

function parseWhatsAppEvents(entry: unknown): MessageEvent[] {
  const parsed = whatsappEntrySchema.safeParse(entry);
  if (!parsed.success) return [];

  return parsed.data.changes.flatMap((change): MessageEvent[] => {
    const result = whatsappChangeSchema.safeParse(change);
    if (!result.success) return [];

    const { metadata, messages, statuses } = result.data.value;
    const account = { channel: "WHATSAPP", accountId: metadata.phone_number_id } as const;
    const statusEvents = (whatsappStatusesSchema.safeParse(statuses).data ?? []).flatMap((item): MessageEvent[] => {
      const status = whatsappStatusSchema.safeParse(item);
      if (!status.success) return [];
      return [{ ...account, kind: "status", externalId: status.data.id, status: statusByWebhookValue[status.data.status] }];
    });
    const reactions = messages.flatMap((message): MessageEvent[] => {
      const parsedReaction = whatsappReactionSchema.safeParse(message);
      if (!parsedReaction.success) return [];
      const { message_id, emoji } = parsedReaction.data.reaction;
      return [{ ...account, kind: "reaction", externalId: message_id, emoji: emoji || null }];
    });
    return [...statusEvents, ...reactions];
  });
}

function parseMessagingEvents(entry: unknown, channel: "FACEBOOK" | "INSTAGRAM"): MessageEvent[] {
  const parsed = messagingEntrySchema.safeParse(entry);
  if (!parsed.success) return [];

  const account = { channel, accountId: parsed.data.id };
  return parsed.data.messaging.flatMap((item): MessageEvent[] => {
    const event = messagingUpdateSchema.safeParse(item);
    if (!event.success) return [];

    const events: MessageEvent[] = [];
    const { read, sender, delivery, reaction } = event.data;
    const parsedDelivery = messagingDeliverySchema.safeParse(delivery);
    for (const mid of parsedDelivery.data?.mids ?? []) {
      const externalId = id.safeParse(mid);
      if (externalId.success) events.push({ ...account, kind: "status", externalId: externalId.data, status: "DELIVERED" });
    }

    const parsedRead = messagingReadSchema.safeParse(read);
    const contact = z.object({ id }).safeParse(sender);
    if (parsedRead.success && contact.success && contact.data.id !== account.accountId) {
      const watermark = new Date(parsedRead.data.watermark);
      if (!Number.isNaN(watermark.getTime())) {
        events.push({ ...account, kind: "read", contactRemoteId: contact.data.id, watermark });
      }
    } else if (channel === "INSTAGRAM") {
      const seen = messagingSeenSchema.safeParse(read);
      if (seen.success) events.push({ ...account, kind: "status", externalId: seen.data.mid, status: "READ" });
    }

    const parsedReaction = messagingReactionSchema.safeParse(reaction);
    if (parsedReaction.success) {
      const data = parsedReaction.data;
      events.push({ ...account, kind: "reaction", externalId: data.mid, emoji: data.action === "react" ? data.emoji : null });
    }
    return events;
  });
}

export function parseMetaEvents(payload: unknown): MessageEvent[] {
  const result = webhookSchema.safeParse(payload);
  if (!result.success) return [];
  const { object, entry } = result.data;
  if (object === "whatsapp_business_account") return entry.flatMap(parseWhatsAppEvents);
  const channel = object === "page" ? "FACEBOOK" : "INSTAGRAM";
  return entry.flatMap((item) => parseMessagingEvents(item, channel));
}
