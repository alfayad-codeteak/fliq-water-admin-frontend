import { z } from "zod";

import { FEATURE_KEYS } from "@/lib/api/types";

const featureEnum = z.enum(FEATURE_KEYS);

export const createAdminSchema = z.object({
  phone: z.string().regex(/^\d{10}$/, "Phone must be 10 digits"),
  name: z.string().min(1).max(120),
  password: z.string().min(6).max(128),
  permissions: z.array(featureEnum).min(1, "Select at least one permission"),
});

export const updateAdminSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(120).optional(),
  password: z.string().min(6).max(128).optional().or(z.literal("")),
  permissions: z.array(featureEnum).min(1).optional(),
});
