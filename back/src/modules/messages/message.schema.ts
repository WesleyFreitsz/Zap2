import { z } from 'zod';
import { templateInputSchema } from '../meta/whatsapp-templates';

export const sendMessageSchema = z.object({
  conversationId: z.string().uuid(),
  content: z.string().trim().min(1, 'Message content is required'),
  replyToId: z.string().uuid().optional(),
});

export type SendMessageInput = z.infer<typeof sendMessageSchema>;

export const sendTemplateSchema = templateInputSchema.omit({ name: true }).extend({
  conversationId: sendMessageSchema.shape.conversationId,
  templateName: templateInputSchema.shape.name,
});

export type SendTemplateInput = z.infer<typeof sendTemplateSchema>;

export const suggestReplySchema = z.object({
  conversationId: z.string().uuid(),
});

export type SuggestReplyInput = z.infer<typeof suggestReplySchema>;

export const sendMediaSchema = z.object({
  conversationId: z.string().uuid(),
  caption: z.string().trim().max(1024).optional().default(''),
  replyToId: z.preprocess((value) => (value === '' ? undefined : value), z.string().uuid().optional()),
  asSticker: z.preprocess((value) => value === true || value === 'true', z.boolean()).default(false),
});

export type SendMediaInput = z.infer<typeof sendMediaSchema>;

export const reactMessageSchema = z.object({
  emoji: z.string().trim().min(1).max(16).nullable(),
});

export type ReactMessageInput = z.infer<typeof reactMessageSchema>;

export const editMessageSchema = z.object({
  content: z.string().trim().min(1, 'Message content is required').max(4096),
});

export type EditMessageInput = z.infer<typeof editMessageSchema>;
