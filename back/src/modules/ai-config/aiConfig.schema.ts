import { z } from 'zod';

export const updateAiConfigSchema = z.object({
  aiName: z.string().min(1).max(100).optional(),
  personality: z.string().min(1).max(50).optional(),
  language: z.string().min(2).max(10).optional(),
  greeting: z.string().min(1).max(500).optional(),
  fallbackMessage: z.string().min(1).max(500).optional(),
  salesMode: z.boolean().optional(),
  autoReply: z.boolean().optional(),
  maxTokens: z.number().int().min(50).max(4000).optional(),
  temperature: z.number().min(0).max(2).optional(),
  systemPrompt: z.string().max(5000).nullable().optional(),
  productContext: z.string().max(5000).nullable().optional(),
});

export type UpdateAiConfigInput = z.infer<typeof updateAiConfigSchema>;
