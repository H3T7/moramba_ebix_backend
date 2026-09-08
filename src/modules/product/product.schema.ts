import { z } from "zod";

export const createProductSchema = z.object({
  itemCode: z.string().min(2, "Item Code is required"),
  name: z.string().min(2, "Product name is required"),
  sku: z.string().min(2, "SKU is required"),
  category: z.string().min(1, "Required"),
  unit: z.string().min(1, "Required"),
  hsCode: z.string().min(2, "HS code is required"),
  // Accepts a number OR a numeric string from the client, always comes out
  // as a string — that's what Drizzle's `numeric` column expects (see the
  // big comment in db/schema/products.ts on why we don't use plain numbers
  // for money).
  defaultRate: z.coerce.number().min(0).transform((n) => n.toFixed(2)),
  currency: z.string().min(1).default("INR"),
});
export type CreateProductInput = z.infer<typeof createProductSchema>;

export const updateProductSchema = createProductSchema.partial();
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
