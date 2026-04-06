import { z } from 'zod';

export const createProductSchema = z.object({
  name: z.string().min(1, 'Product name is required'),
  description: z.string().optional(),
  price: z.number().positive('Price must be positive'),
  image: z.string().url().optional(),
});

export const updateProductSchema = createProductSchema.partial();

export const sendProductToChatSchema = z.object({
  productId: z.string().uuid(),
  conversationId: z.string().uuid(),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
