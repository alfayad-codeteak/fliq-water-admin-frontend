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
  name: z.string().trim().max(120).optional(),
  label: z.string().trim().min(1, "Label is required").max(60),
  line1: z.string().trim().min(1, "Address line is required").max(200),
  city: z.string().trim().max(80).optional(),
  state: z.string().trim().max(80).optional(),
  pincode: z
    .string()
    .trim()
    .max(12)
    .optional()
    .refine((v) => !v || v.length >= 4, {
      message: "Pincode must be at least 4 characters",
    }),
  isDefault: z.boolean().optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
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
