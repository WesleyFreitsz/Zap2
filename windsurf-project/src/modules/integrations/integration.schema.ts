import { z } from 'zod';

export const createIntegrationSchema = z.object({
  type: z.enum(['WHATSAPP', 'INSTAGRAM', 'FACEBOOK']),
  token: z.string().min(1, 'Token is required'),
});

export type CreateIntegrationInput = z.infer<typeof createIntegrationSchema>;
