import { z } from "zod";

export const quickReplySchema = z.object({
  shortcut: z.string().min(1).max(30).regex(/^[a-z0-9-]+$/),
  content: z.string().min(1).max(2000).refine((content) => content.trim().length > 0),
});

export type QuickReplyInput = z.infer<typeof quickReplySchema>;
