import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { IntegrationType } from "@prisma/client";
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
      if (!parsedMessage.success) return [];
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
