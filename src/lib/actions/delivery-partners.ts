"use server";

import { revalidatePath } from "next/cache";

import { backendFetch } from "@/lib/api/server-fetch";

export async function createDeliveryPartnerAction(payload: {
  phone: string;
  name: string;
  password: string;
  vehicleType?: string;
  vehicleNumber?: string;
}) {
  const res = await backendFetch("/api/admin/delivery-partners", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      phone: payload.phone.replace(/\D/g, "").slice(-10),
      name: payload.name.trim(),
      password: payload.password,
      ...(payload.vehicleType?.trim()
        ? { vehicleType: payload.vehicleType.trim() }
        : {}),
      ...(payload.vehicleNumber?.trim()
        ? { vehicleNumber: payload.vehicleNumber.trim() }
        : {}),
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    return { ok: false as const, error: t || `HTTP ${res.status}` };
  }
  revalidatePath("/delivery-partners");
  return { ok: true as const };
}

export async function updateDeliveryPartnerAction(
  id: string,
  patch: {
    name?: string;
    vehicleType?: string;
    vehicleNumber?: string;
    isAvailable?: boolean;
    currentLat?: number;
    currentLng?: number;
  }
) {
  const body: Record<string, unknown> = {};
  if (patch.name !== undefined) body.name = patch.name;
  if (patch.vehicleType !== undefined)
    body.vehicleType = patch.vehicleType || null;
  if (patch.vehicleNumber !== undefined)
    body.vehicleNumber = patch.vehicleNumber || null;
  if (patch.isAvailable !== undefined) body.isAvailable = patch.isAvailable;
  if (patch.currentLat !== undefined) body.currentLat = patch.currentLat;
  if (patch.currentLng !== undefined) body.currentLng = patch.currentLng;

  const res = await backendFetch(`/api/admin/delivery-partners/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text();
    return { ok: false as const, error: t || `HTTP ${res.status}` };
  }
  revalidatePath("/delivery-partners");
  revalidatePath("/orders");
  return { ok: true as const };
}

export async function deleteDeliveryPartnerAction(id: string) {
  const res = await backendFetch(`/api/admin/delivery-partners/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const t = await res.text();
    return { ok: false as const, error: t || `HTTP ${res.status}` };
  }
  revalidatePath("/delivery-partners");
  revalidatePath("/orders");
  return { ok: true as const };
}
