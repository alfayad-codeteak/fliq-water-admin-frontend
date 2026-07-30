import { z } from "zod";

const optionalNonNegNumber = z.preprocess((v) => {
  if (v === "" || v == null) return undefined;
  return v;
}, z.coerce.number().nonnegative().optional());

const optionalMrp = z.preprocess((v) => {
  if (v === "") return null;
  return v;
}, z.union([z.null(), z.coerce.number().nonnegative()]).optional());

const handlingFeeField = z.preprocess((v) => {
  if (v === "" || v == null) return 0;
  return v;
}, z.coerce.number().nonnegative().default(0));

/**
 * Prefer `salePrice` when both are present; keep `price` in sync for older clients.
 */
function resolveSalePrice(data: {
  salePrice?: number;
  price?: number;
}): number | undefined {
  if (data.salePrice != null) return data.salePrice;
  if (data.price != null) return data.price;
  return undefined;
}

export const createProductSchema = z
  .object({
    name: z.string().min(1).max(200),
    salePrice: optionalNonNegNumber,
    price: optionalNonNegNumber,
    mrp: optionalMrp,
    handlingFee: handlingFeeField,
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
  })
  .superRefine((data, ctx) => {
    if (resolveSalePrice(data) == null) {
      ctx.addIssue({
        code: "custom",
        message: "Sale price is required",
        path: ["salePrice"],
      });
    }
  })
  .transform((data) => {
    const sale = resolveSalePrice(data)!;
    return {
      name: data.name,
      salePrice: sale,
      price: sale,
      mrp: data.mrp ?? undefined,
      handlingFee: data.handlingFee ?? 0,
      stock: data.stock,
      hasDeposit: data.hasDeposit,
      photoUrl: data.photoUrl,
      photoUrls: data.photoUrls,
      category: data.category,
    };
  });

export const updateProductSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1).max(200).optional(),
    salePrice: optionalNonNegNumber,
    price: optionalNonNegNumber,
    mrp: optionalMrp,
    handlingFee: optionalNonNegNumber,
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
  })
  .transform((data) => {
    const sale = resolveSalePrice(data);
    return {
      ...data,
      ...(sale != null ? { salePrice: sale, price: sale } : {}),
    };
  });

export const bulkUpdateProductsSchema = z.object({
  items: z
    .array(
      z
        .object({
          id: z.string().min(1),
          salePrice: optionalNonNegNumber,
          price: optionalNonNegNumber,
          mrp: optionalMrp,
          handlingFee: optionalNonNegNumber,
          stock: z.coerce.number().int().nonnegative(),
        })
        .superRefine((data, ctx) => {
          if (resolveSalePrice(data) == null) {
            ctx.addIssue({
              code: "custom",
              message: "Sale price is required",
              path: ["salePrice"],
            });
          }
        })
        .transform((data) => {
          const sale = resolveSalePrice(data)!;
          return {
            id: data.id,
            salePrice: sale,
            price: sale,
            ...(data.mrp !== undefined ? { mrp: data.mrp } : {}),
            ...(data.handlingFee !== undefined
              ? { handlingFee: data.handlingFee }
              : {}),
            stock: data.stock,
          };
        })
    )
    .min(1),
});
