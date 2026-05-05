"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { backendFetch } from "@/lib/api/server-fetch";
import {
  createDeliveryZoneSchema,
  updateDeliveryZoneSchema,
} from "@/lib/validations/delivery-zone";

async function requireStaff() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  if (!["owner", "admin"].includes(session.user.role)) {
    throw new Error("Forbidden");
  }
  return session;
}

export async function createDeliveryZoneAction(payload: {
  name: string;
  centerLat: number | string;
  centerLng: number | string;
  radiusKm: number | string;
  isActive?: boolean;
}) {
  await requireStaff();
  const parsed = createDeliveryZoneSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.flatten().fieldErrors };
  }

  const res = await backendFetch("/api/admin/delivery-zones", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(parsed.data),
  });
  if (!res.ok) {
    const t = await res.text();
    return { ok: false as const, error: { root: [t || `HTTP ${res.status}`] } };
  }

  revalidatePath("/delivery-zones");
  return { ok: true as const };
}

export async function updateDeliveryZoneAction(
  id: string,
  patch: {
    name?: string;
    centerLat?: number | string;
    centerLng?: number | string;
    radiusKm?: number | string;
    isActive?: boolean;
  }
) {
  await requireStaff();
  const parsed = updateDeliveryZoneSchema.safeParse({ id, ...patch });
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.flatten().fieldErrors };
  }

  const rest: Record<string, unknown> = { ...parsed.data };
  delete rest.id;
  const body: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(rest)) {
    if (v !== undefined) body[k] = v;
  }

  const res = await backendFetch(`/api/admin/delivery-zones/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text();
    return { ok: false as const, error: { root: [t || `HTTP ${res.status}`] } };
  }

  revalidatePath("/delivery-zones");
  return { ok: true as const };
}

export async function deleteDeliveryZoneAction(id: string) {
  await requireStaff();
  const res = await backendFetch(`/api/admin/delivery-zones/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const t = await res.text();
    return { ok: false as const, error: t || `HTTP ${res.status}` };
  }
  revalidatePath("/delivery-zones");
  return { ok: true as const };
}

