import { z } from 'zod';

export const createConversationSchema = z.object({
  contactName: z.string().min(1, 'Contact name is required'),
  contactPhone: z.string().min(1, 'Contact phone is required'),
  channel: z.enum(['WHATSAPP', 'INSTAGRAM', 'FACEBOOK']).default('WHATSAPP'),
});

export const transferConversationSchema = z.object({
  conversationId: z.string().uuid(),
  toUserId: z.string().uuid(),
});

export const assignConversationSchema = z.object({
  conversationId: z.string().uuid(),
  toUserId: z.string().uuid(),
});

export type CreateConversationInput = z.infer<typeof createConversationSchema>;
export type TransferConversationInput = z.infer<typeof transferConversationSchema>;
