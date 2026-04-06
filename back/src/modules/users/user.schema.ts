import { z } from "zod";

const nameSchema = z
  .string()
  .min(2)
  .regex(/^[A-Za-zÀ-ÿ\s'’-]+$/, "Name must contain only letters");

export const createUserSchema = z.object({
  name: nameSchema,
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(["ADMIN", "EMPLOYEE"]).default("EMPLOYEE"),
  isTeamLeader: z.boolean().optional().default(false),
});

export const updateProfileSchema = z.object({
  name: nameSchema,
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
