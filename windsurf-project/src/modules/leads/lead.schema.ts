import { z } from "zod";

const leadNameSchema = z
  .string()
  .min(2)
  .regex(/^[A-Za-zÀ-ÿ\s'’-]+$/, "Name must contain only letters");

const leadPhoneSchema = z
  .string()
  .transform((value) => value.replace(/\D/g, ""))
  .refine((value) => value.length >= 8, "Phone must contain at least 8 digits");

export const createLeadSchema = z.object({
  name: leadNameSchema,
  phone: leadPhoneSchema,
  email: z.string().email().optional().nullable(),
  temperature: z.enum(["HOT", "WARM", "COLD", "CONVERTED"]).optional(),
  status: z
    .enum(["NEW", "IN_ATTENDANCE", "WAITING", "FOLLOW_UP", "CLOSED", "LOST"])
    .optional(),
  notes: z.string().optional().nullable(),
  assignedToId: z.string().uuid().optional().nullable(),
});

export const updateLeadSchema = createLeadSchema.partial();

export type CreateLeadInput = z.infer<typeof createLeadSchema>;
export type UpdateLeadInput = z.infer<typeof updateLeadSchema>;
