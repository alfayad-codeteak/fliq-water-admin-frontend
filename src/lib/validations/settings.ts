import { z } from "zod";

export const profileSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email(),
});

export const siteSettingsSchema = z.object({
  siteName: z.string().min(1).max(120),
});
