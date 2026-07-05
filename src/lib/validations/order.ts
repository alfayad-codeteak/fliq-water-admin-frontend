import { z } from "zod";

export const adminOrderItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.coerce.number().int().positive(),
});

export const adminCreateOrderSchema = z.object({
  userId: z.string().min(1),
  addressId: z.string().min(1),
  timeSlot: z.string().min(1).max(64),
  paymentMethod: z.string().min(1).max(32),
  items: z.array(adminOrderItemSchema).min(1),
  ifCanRefund: z.boolean().optional(),
  returnedCanCount: z.coerce.number().int().nonnegative().optional(),
});

export type AdminCreateOrderInput = z.infer<typeof adminCreateOrderSchema>;
