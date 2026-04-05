import { z } from 'zod';

export const sendMessageSchema = z.object({
  conversationId: z.string().uuid(),
  content: z.string().min(1, 'Message content is required'),
  sender: z.enum(['CLIENT', 'USER', 'SYSTEM']).default('USER'),
});

export type SendMessageInput = z.infer<typeof sendMessageSchema>;
