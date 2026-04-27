import { z } from "zod";

export const loginSchema = z.object({
  phone: z
    .string()
    .regex(/^\d{10}$/, "Enter exactly 10 digits"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export type LoginValues = z.infer<typeof loginSchema>;
