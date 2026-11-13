"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { backendFetch } from "@/lib/api/server-fetch";
import {
  dbAddHeldDeposit,
  dbReturnHeldDeposit,
} from "@/lib/db/admin-reads";
import { isBusinessDbConfigured } from "@/lib/db/business-pool";
import { userFacingError, userFacingErrorFromResponse } from "@/lib/user-facing-error";
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
    return { ok: false as const, error: await userFacingErrorFromResponse(res) };
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
    return { ok: false as const, error: await userFacingErrorFromResponse(res) };
  }

  revalidatePath("/deposits");
  return { ok: true as const };
}

function revalidateDepositPages() {
  revalidatePath("/deposits");
  revalidatePath("/customers");
}

async function fallbackWalletWrite(
  res: Response,
  write: () => Promise<unknown>,
): Promise<{ ok: true } | { ok: false; error: string } | null> {
  if (res.ok || res.status !== 404 || !isBusinessDbConfigured()) {
    return null;
  }
  try {
    await write();
    revalidateDepositPages();
    return { ok: true as const };
  } catch (e) {
    const message = e instanceof Error ? e.message : "";
    if (message && !message.includes("DATABASE_URL")) {
      return { ok: false as const, error: userFacingError(message) };
    }
    return null;
  }
}

export async function addCustomerWalletDepositAction(formData: FormData) {
  const session = await requireStaff();

  const userId = String(formData.get("userId") ?? "").trim();
  if (!userId) return { ok: false as const, error: "Select a customer" };

  const parsed = walletCreditSchema.safeParse({
    amount: formData.get("amount"),
  });
  if (!parsed.success) {
    return { ok: false as const, error: "Enter a valid amount" };
  }

  const res = await backendFetch(
    `/api/admin/deposits/wallet/${encodeURIComponent(userId)}/add`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: parsed.data.amount }),
    },
  );
  const fallback = await fallbackWalletWrite(res, () =>
    dbAddHeldDeposit({
      userId,
      amount: parsed.data.amount,
      adminUserId: session.user.id,
    }),
  );
  if (fallback) return fallback;
  if (!res.ok) {
    return { ok: false as const, error: await userFacingErrorFromResponse(res) };
  }

  revalidateDepositPages();
  return { ok: true as const };
}

export async function returnCustomerWalletDepositAction(formData: FormData) {
  const session = await requireStaff();

  const userId = String(formData.get("userId") ?? "").trim();
  if (!userId) return { ok: false as const, error: "Select a customer" };

  const parsed = walletCreditSchema.safeParse({
    amount: formData.get("amount"),
  });
  if (!parsed.success) {
    return { ok: false as const, error: "Enter a valid amount" };
  }

  const note = String(formData.get("note") ?? "").trim();
  const res = await backendFetch(
    `/api/admin/deposits/wallet/${encodeURIComponent(userId)}/return`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: parsed.data.amount,
        ...(note ? { note } : {}),
      }),
    },
  );
  const fallback = await fallbackWalletWrite(res, () =>
    dbReturnHeldDeposit({
      userId,
      amount: parsed.data.amount,
      note: note || undefined,
      adminUserId: session.user.id,
    }),
  );
  if (fallback) return fallback;
  if (!res.ok) {
    return { ok: false as const, error: await userFacingErrorFromResponse(res) };
  }

  revalidateDepositPages();
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
    return { ok: false as const, error: await userFacingErrorFromResponse(res) };
  }

  revalidatePath("/orders");
  revalidatePath("/dashboard");
  revalidatePath("/deposits");
  return { ok: true as const };
}
