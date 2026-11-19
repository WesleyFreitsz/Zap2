import { z } from 'zod';
import { templateInputSchema } from '../meta/whatsapp-templates';

export const sendMessageSchema = z.object({
  conversationId: z.string().uuid(),
  content: z.string().trim().min(1, 'Message content is required'),
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
