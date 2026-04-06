import { z } from "zod";

const optionalString = z.preprocess(
  (value) => (value === "" || value === null ? undefined : value),
  z.string().optional(),
);

const requiredNumber = z.preprocess(
  (value) => (value === "" || value === null ? undefined : Number(value)),
  z.number().positive("Price must be positive"),
);

const optionalNumber = z.preprocess(
  (value) => (value === "" || value === null ? undefined : Number(value)),
  z.number().nonnegative().optional(),
);

const optionalInteger = z.preprocess(
  (value) => (value === "" || value === null ? undefined : Number(value)),
  z.number().int().nonnegative().optional(),
);

const optionalBoolean = z.preprocess((value) => {
  if (value === "true") return true;
  if (value === "false") return false;
  return value;
}, z.boolean().optional());

export const createProductSchema = z.object({
  name: z.string().min(1, "Product name is required"),
  code: optionalString,
  description: optionalString,
  price: requiredNumber,
  image: optionalString,
  imageUrl: optionalString,
  category: optionalString,
  promotionalPrice: optionalNumber,
  stock: optionalInteger,
  active: optionalBoolean,
  whatsappMessage: optionalString,
});

export const updateProductSchema = createProductSchema.partial();

export const sendProductToChatSchema = z.object({
  productId: z.string().uuid(),
  conversationId: z.string().uuid(),
  customMessage: z.string().optional(),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
