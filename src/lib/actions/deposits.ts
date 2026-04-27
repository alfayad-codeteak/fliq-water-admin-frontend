"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { backendFetch } from "@/lib/api/server-fetch";
import {
  returnCansSchema,
  updateDepositConfigSchema,
  walletCreditSchema,
} from "@/lib/validations/deposits";

async function requireStaff() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  if (!["owner", "admin"].includes(session.user.role)) {
    throw new Error("Forbidden");
  }
  return session;
}

export async function updateDepositConfigAction(formData: FormData) {
  await requireStaff();

  const enabledRaw = String(formData.get("enabled") ?? "true");
  const perCanAmount = formData.get("perCanAmount");

  const parsed = updateDepositConfigSchema.safeParse({
    enabled: enabledRaw === "true" || enabledRaw === "on",
    perCanAmount,
    promoStartsAt: undefined,
    promoEndsAt: undefined,
    tiers: [],
  });
  if (!parsed.success) {
    return { ok: false as const, error: "Invalid config values" };
  }

  const body = {
    enabled: parsed.data.enabled ?? true,
    perCanAmount: parsed.data.perCanAmount,
    promoStartsAt: null,
    promoEndsAt: null,
    tiers: [],
  };

  const res = await backendFetch("/api/deposits/config", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text();
    return { ok: false as const, error: t || `HTTP ${res.status}` };
  }

  revalidatePath("/deposits");
  revalidatePath("/orders");
  return { ok: true as const };
}

export async function topUpMyWalletAction(formData: FormData) {
  await requireStaff();

  const parsed = walletCreditSchema.safeParse({
    amount: formData.get("amount"),
  });
  if (!parsed.success) {
    return { ok: false as const, error: "Enter a valid amount" };
  }

  const res = await backendFetch("/api/deposits/wallet/me/top-up", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amount: parsed.data.amount }),
  });
  if (!res.ok) {
    const t = await res.text();
    return { ok: false as const, error: t || `HTTP ${res.status}` };
  }

  revalidatePath("/deposits");
  return { ok: true as const };
}

export async function addCustomerWalletDepositAction(formData: FormData) {
  await requireStaff();

  const userId = String(formData.get("userId") ?? "").trim();
  if (!userId) return { ok: false as const, error: "Select a customer" };

  const parsed = walletCreditSchema.safeParse({
    amount: formData.get("amount"),
  });
  if (!parsed.success) {
    return { ok: false as const, error: "Enter a valid amount" };
  }

  const res = await backendFetch(`/api/admin/deposits/wallet/${userId}/add`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amount: parsed.data.amount }),
  });
  if (!res.ok) {
    const t = await res.text();
    return { ok: false as const, error: t || `HTTP ${res.status}` };
  }

  revalidatePath("/deposits");
  return { ok: true as const };
}

export async function refundReturnedCansAction(orderId: string, returnedCans: number) {
  await requireStaff();

  const parsed = returnCansSchema.safeParse({ returnedCans });
  if (!parsed.success) {
    return { ok: false as const, error: "Enter a valid returned cans count" };
  }

  const res = await backendFetch(`/api/admin/orders/${orderId}/return-cans`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ returnedCans: parsed.data.returnedCans }),
  });
  if (!res.ok) {
    const t = await res.text();
    return { ok: false as const, error: t || `HTTP ${res.status}` };
  }

  revalidatePath("/orders");
  revalidatePath("/dashboard");
  revalidatePath("/deposits");
  return { ok: true as const };
}
