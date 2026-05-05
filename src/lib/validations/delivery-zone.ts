import { z } from "zod";

export const createDeliveryZoneSchema = z.object({
  name: z.string().min(1).max(120),
  centerLat: z.coerce.number().min(-90).max(90),
  centerLng: z.coerce.number().min(-180).max(180),
  radiusKm: z.coerce.number().positive().max(500),
  isActive: z.boolean().optional(),
});

export const updateDeliveryZoneSchema = createDeliveryZoneSchema.partial().extend({
  id: z.string().min(1),
});

