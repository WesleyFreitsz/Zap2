import { z } from 'zod';
import { templateInputSchema } from '../meta/whatsapp-templates';

export const createScheduleSchema = z.object({
  conversationId: z.string().uuid(),
  content: z.string().min(1, 'Message content is required'),
  sendAt: z.string().datetime('Invalid datetime format'),
  template: templateInputSchema.optional(),
});

export type CreateScheduleInput = z.infer<typeof createScheduleSchema>;

export const updateScheduleSchema = z.object({
  content: z.string().trim().min(1, 'Message content is required').optional(),
  sendAt: z.string().datetime('Invalid datetime format').optional(),
});

export type UpdateScheduleInput = z.infer<typeof updateScheduleSchema>;
