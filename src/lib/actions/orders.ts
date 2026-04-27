"use server";

import { revalidatePath } from "next/cache";

import { backendFetch } from "@/lib/api/server-fetch";

export async function updateOrderStatusAction(orderId: string, status: string) {
  const res = await backendFetch(`/api/admin/orders/${orderId}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) {
    const t = await res.text();
    return { ok: false as const, error: t || `HTTP ${res.status}` };
  }
  revalidatePath("/orders");
  revalidatePath("/dashboard");
  return { ok: true as const };
}

export async function cancelOrderAction(orderId: string) {
  const res = await backendFetch(`/api/admin/orders/${orderId}/cancel`, {
    method: "PATCH",
  });
  if (!res.ok) {
    const t = await res.text();
    return { ok: false as const, error: t || `HTTP ${res.status}` };
  }
  revalidatePath("/orders");
  revalidatePath("/dashboard");
  return { ok: true as const };
}

export async function assignOrderToPartnerAction(
  orderId: string,
  deliveryPartnerId: string
) {
  const res = await backendFetch(`/api/admin/orders/${orderId}/assign`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ deliveryPartnerId }),
  });
  if (!res.ok) {
    const t = await res.text();
    return { ok: false as const, error: t || `HTTP ${res.status}` };
  }
  revalidatePath("/orders");
  revalidatePath("/dashboard");
  return { ok: true as const };
}
