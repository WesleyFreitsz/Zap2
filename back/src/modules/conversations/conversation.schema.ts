import { z } from 'zod';

export const createConversationSchema = z.object({
  contactName: z.string().min(1, 'Contact name is required'),
  contactPhone: z.string().min(1, 'Contact phone is required'),
  channel: z.enum(['WHATSAPP', 'INSTAGRAM', 'FACEBOOK']).default('WHATSAPP'),
  leadId: z.string().uuid().optional(),
});

export const transferConversationSchema = z.object({
  conversationId: z.string().uuid(),
  toUserId: z.string().uuid(),
});

export const assignConversationSchema = z.object({
  conversationId: z.string().uuid(),
  toUserId: z.string().uuid(),
});

export const updateConversationSchema = z.object({
  contactName: z.string().trim().min(1).optional(),
  contactPhone: z.string().trim().min(1).optional(),
  contactRemoteId: z.string().trim().min(1).optional(),
  contactAvatarUrl: z.string().url().nullable().optional(),
  leadId: z.string().uuid().nullable().optional(),
  status: z.enum(['OPEN', 'CLOSED', 'TRANSFERRED']).optional(),
});

export type CreateConversationInput = z.infer<typeof createConversationSchema>;
export type TransferConversationInput = z.infer<typeof transferConversationSchema>;
export type UpdateConversationInput = z.infer<typeof updateConversationSchema>;
