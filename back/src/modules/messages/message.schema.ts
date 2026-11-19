import { z } from 'zod';

export const sendMessageSchema = z.object({
  conversationId: z.string().uuid(),
  content: z.string().trim().min(1, 'Message content is required'),
});

export type SendMessageInput = z.infer<typeof sendMessageSchema>;

export const suggestReplySchema = z.object({
  conversationId: z.string().uuid(),
});

export type SuggestReplyInput = z.infer<typeof suggestReplySchema>;
