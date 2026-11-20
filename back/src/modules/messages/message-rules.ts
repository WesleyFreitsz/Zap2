import type { Message, Prisma } from "@prisma/client";

export const EDIT_WINDOW_MS = 15 * 60 * 1000;

export function getWhatsAppMessageKey(externalId: string): string | null {
  const value = externalId.trim();
  const serialized = /^(?:true|false)_[^_]+_([^_]+)/.exec(value);
  if (serialized) return serialized[1];
  return value && !/[_@]/.test(value) ? value : null;
}

export function getWhatsAppChatId(externalId: string): string | null {
  return /^(?:true|false)_([^_]+@[^_]+)_/.exec(externalId.trim())?.[1] ?? null;
}

export function canEditMessage(
  message: Pick<Message, "sender" | "deletedAt" | "createdAt">,
  now = new Date(),
): boolean {
  return (
    message.sender === "USER" &&
    !message.deletedAt &&
    now.getTime() - message.createdAt.getTime() <= EDIT_WINDOW_MS
  );
}

type QuotedMessage = Pick<Message, "id" | "content" | "sender" | "mediaType" | "deletedAt">;

export function presentMessage<T extends Message & { replyTo?: QuotedMessage | null }>(message: T) {
  const { replyTo, ...rest } = message;
  const visible = message.deletedAt
    ? { ...rest, content: "", mediaType: null, mediaUrl: null, mimeType: null, fileName: null, fileSize: null }
    : rest;
  return {
    ...visible,
    replyTo: replyTo
      ? {
          id: replyTo.id,
          content: replyTo.deletedAt ? "" : replyTo.content,
          sender: replyTo.sender,
          mediaType: replyTo.deletedAt ? null : replyTo.mediaType,
        }
      : null,
  };
}

export const replyToSelect = {
  select: { id: true, content: true, sender: true, mediaType: true, deletedAt: true },
} satisfies Prisma.Message$replyToArgs;
