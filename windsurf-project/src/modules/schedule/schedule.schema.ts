import { z } from 'zod';

export const createScheduleSchema = z.object({
  conversationId: z.string().uuid(),
  content: z.string().min(1, 'Message content is required'),
  sendAt: z.string().datetime('Invalid datetime format'),
});

export type CreateScheduleInput = z.infer<typeof createScheduleSchema>;
