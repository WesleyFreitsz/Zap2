import { z } from 'zod';

export const updateAiConfigSchema = z.object({
  personality: z.string().min(1).max(50).optional(),
  language: z.string().min(2).max(10).optional(),
  maxTokens: z.number().int().min(50).max(4000).optional(),
  temperature: z.number().min(0).max(2).optional(),
  systemPrompt: z.string().max(5000).nullable().optional(),
  productContext: z.string().max(5000).nullable().optional(),
});

export type UpdateAiConfigInput = z.infer<typeof updateAiConfigSchema>;
