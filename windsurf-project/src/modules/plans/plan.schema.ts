import { z } from "zod";

const nonNegativeNumber = z.coerce.number().min(0);
const nonNegativeInt = z.coerce.number().int().min(0);

export const createPlanSchema = z.object({
  name: z.string().min(2),
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/, "Slug must contain only lowercase letters, numbers, and hyphens"),
  price: nonNegativeNumber,
  annualPrice: nonNegativeNumber,
  maxNumbers: nonNegativeInt.default(1),
  maxEmployees: nonNegativeInt.default(5),
  maxTeamLeaders: nonNegativeInt.default(0),
  features: z.array(z.string().min(1)).optional().default([]),
  founderSlots: nonNegativeInt.default(10),
  isActive: z.boolean().optional(),
});

export const updatePlanSchema = createPlanSchema.partial();

export type CreatePlanInput = z.infer<typeof createPlanSchema>;
export type UpdatePlanInput = z.infer<typeof updatePlanSchema>;
