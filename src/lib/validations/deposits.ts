import { z } from "zod";

export const depositTierSchema = z.object({
  minQty: z.coerce.number().int().positive(),
  discountPercent: z.coerce.number().min(0).max(100),
});

export const updateDepositConfigSchema = z.object({
  enabled: z.boolean().optional(),
  perCanAmount: z.coerce.number().nonnegative(),
  promoStartsAt: z.string().optional(),
  promoEndsAt: z.string().optional(),
  tiers: z.array(depositTierSchema).default([]),
});

export const walletCreditSchema = z.object({
  amount: z.coerce.number().positive(),
});

export const returnCansSchema = z.object({
  returnedCans: z.coerce.number().int().positive(),
});
