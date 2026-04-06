import { z } from "zod";

export const createLeadSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(10).regex(/^\d+$/, "O telefone deve conter apenas números"),
  email: z.string().email().optional().nullable(),
  temperature: z.enum(["HOT", "WARM", "COLD", "CONVERTED"]).optional(),
  status: z
    .enum(["NEW", "IN_ATTENDANCE", "WAITING", "FOLLOW_UP", "CLOSED", "LOST"])
    .optional(),
  notes: z.string().optional().nullable(),
  assignedToId: z.string().uuid().optional().nullable(),
  tags: z.array(z.string().uuid()).optional().default([]),
});

export const updateLeadSchema = createLeadSchema.partial();

export type CreateLeadInput = z.infer<typeof createLeadSchema>;
export type UpdateLeadInput = z.infer<typeof updateLeadSchema>;
