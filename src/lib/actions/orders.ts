"use server";

import { revalidatePath } from "next/cache";

import { backendFetch } from "@/lib/api/server-fetch";
import type { AdminCreateOrderDto, OrderDto } from "@/lib/api/types";
import { adminCreateOrderSchema } from "@/lib/validations/order";

function parseApiError(text: string): string {
  try {
    const j = JSON.parse(text) as { message?: string | string[] };
    if (Array.isArray(j.message)) return j.message.join(", ");
    if (typeof j.message === "string") return j.message;
  } catch {
    /* plain text */
  }
  return text;
}

export async function quoteAdminOrderAction(payload: AdminCreateOrderDto) {
  const parsed = adminCreateOrderSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.flatten().fieldErrors };
  }

  const res = await backendFetch("/api/admin/orders/quote", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(parsed.data),
  });
  if (!res.ok) {
    const t = await res.text();
    return {
      ok: false as const,
      error: { root: [parseApiError(t) || `HTTP ${res.status}`] },
    };
  }

  const data = (await res.json()) as OrderDto;
  return { ok: true as const, data };
}

export async function createAdminOrderAction(payload: AdminCreateOrderDto) {
  const parsed = adminCreateOrderSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.flatten().fieldErrors };
  }

  const res = await backendFetch("/api/admin/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(parsed.data),
  });
  if (!res.ok) {
    const t = await res.text();
    return {
      ok: false as const,
      error: { root: [parseApiError(t) || `HTTP ${res.status}`] },
    };
  }

  const data = (await res.json()) as OrderDto;
  revalidatePath("/orders");
  revalidatePath("/dashboard");
  return { ok: true as const, data };
}

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
