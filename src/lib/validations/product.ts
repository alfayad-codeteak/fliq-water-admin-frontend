import { z } from "zod";

export const createProductSchema = z.object({
  name: z.string().min(1).max(200),
  price: z.coerce.number().nonnegative(),
  stock: z.coerce.number().int().nonnegative(),
  hasDeposit: z.boolean().optional(),
  photoUrl: z
    .union([z.string().url(), z.literal("")])
    .optional()
    .transform((v) => (v === "" ? undefined : v)),
  photoUrls: z.array(z.string().url()).optional(),
  category: z
    .string()
    .max(120)
    .optional()
    .transform((v) => (v === "" ? undefined : v)),
});

export const updateProductSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(200).optional(),
  price: z.coerce.number().nonnegative().optional(),
  stock: z.coerce.number().int().nonnegative().optional(),
  hasDeposit: z.boolean().optional(),
  photoUrl: z
    .union([z.string().url(), z.literal("")])
    .optional()
    .transform((v) => (v === "" ? undefined : v)),
  photoUrls: z.array(z.string().url()).optional(),
  category: z
    .string()
    .max(120)
    .optional()
    .transform((v) => (v === "" ? undefined : v)),
  isActive: z.boolean().optional(),
});

export const bulkUpdateProductsSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.string().min(1),
        price: z.coerce.number().nonnegative(),
        stock: z.coerce.number().int().nonnegative(),
      })
    )
    .min(1),
});
