import { z } from "zod";

export const createCustomerSchema = z.object({
  phone: z.string().regex(/^\d{10}$/, "Phone must be exactly 10 digits"),
  name: z.string().trim().max(120).optional(),
  password: z
    .string()
    .optional()
    .refine((v) => !v || v.length >= 6, {
      message: "Password must be at least 6 characters",
    }),
});

export const createCustomerAddressSchema = z.object({
  label: z.string().trim().min(1, "Label is required").max(60),
  line1: z.string().trim().min(1, "Address line is required").max(200),
  city: z.string().trim().min(1, "City is required").max(80),
  state: z.string().trim().min(1, "State is required").max(80),
  pincode: z.string().trim().min(4, "Pincode is required").max(12),
  isDefault: z.boolean().optional(),
});

export const createCustomerWithAddressSchema = createCustomerSchema.extend({
  address: createCustomerAddressSchema,
});

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type CreateCustomerAddressInput = z.infer<
  typeof createCustomerAddressSchema
>;
export type CreateCustomerWithAddressInput = z.infer<
  typeof createCustomerWithAddressSchema
>;
