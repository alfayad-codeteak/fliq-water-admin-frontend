import { z } from "zod";

export const purchaseEntryItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.coerce.number().int().positive(),
  unitCost: z.coerce.number().nonnegative(),
});

export const createPurchaseEntrySchema = z.object({
  supplierName: z.string().max(200).optional(),
  referenceNo: z.string().max(120).optional(),
  notes: z.string().max(500).optional(),
  purchasedAt: z.string().datetime().optional(),
  items: z.array(purchaseEntryItemSchema).min(1),
});
