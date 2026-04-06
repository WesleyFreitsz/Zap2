import { z } from "zod";

const leadNameSchema = z
  .string()
  .min(2, "Nome deve ter pelo menos 2 caracteres")
  .regex(/^[A-Za-zÀ-ÿ\s'’-]+$/, "Nome deve conter apenas letras");

const leadPhoneSchema = z
  .string()
  .transform((value) => value.replace(/\D/g, "")) // limpa máscara
  .refine(
    (value) => value.length >= 10,
    "Telefone deve ter pelo menos 10 dígitos (com DDD)"
  );

export const createLeadSchema = z.object({
  name: leadNameSchema,
  phone: leadPhoneSchema,
  email: z.string().email("Email inválido").optional().nullable(),
  temperature: z
    .enum(["HOT", "WARM", "COLD", "CONVERTED"])
    .optional(),
  status: z
    .enum([
      "NEW",
      "IN_ATTENDANCE",
      "WAITING",
      "FOLLOW_UP",
      "CLOSED",
      "LOST",
    ])
    .optional(),
  notes: z.string().optional().nullable(),
  assignedToId: z.string().uuid().optional().nullable(),
  tags: z.array(z.string().uuid()).optional().default([]),
});

export const updateLeadSchema = createLeadSchema.partial();

export type CreateLeadInput = z.infer<typeof createLeadSchema>;
export type UpdateLeadInput = z.infer<typeof updateLeadSchema>;