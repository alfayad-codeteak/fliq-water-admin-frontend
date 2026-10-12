"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { backendFetch } from "@/lib/api/server-fetch";
import type { AdminCreatePurchaseEntryDto, PurchaseEntryDto } from "@/lib/api/types";
import { createPurchaseEntrySchema } from "@/lib/validations/purchase-entry";
import { userFacingErrorFromResponse } from "@/lib/user-facing-error";

async function requireStaff() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  if (!["owner", "admin"].includes(session.user.role)) {
    throw new Error("Forbidden");
  }
  return session;
}


export async function createPurchaseEntryAction(
  payload: AdminCreatePurchaseEntryDto
) {
  await requireStaff();
  const parsed = createPurchaseEntrySchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.flatten().fieldErrors };
  }

  const body: Record<string, unknown> = {
    items: parsed.data.items,
  };
  if (parsed.data.supplierName?.trim()) {
    body.supplierName = parsed.data.supplierName.trim();
  }
  if (parsed.data.referenceNo?.trim()) {
    body.referenceNo = parsed.data.referenceNo.trim();
  }
  if (parsed.data.notes?.trim()) {
    body.notes = parsed.data.notes.trim();
  }
  if (parsed.data.purchasedAt) {
    body.purchasedAt = parsed.data.purchasedAt;
  }

  const res = await backendFetch("/api/admin/purchase-entries", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    return {
      ok: false as const,
      error: { root: [await userFacingErrorFromResponse(res)] },
    };
  }

  const data = (await res.json()) as PurchaseEntryDto;
  revalidatePath("/purchase-entries");
  revalidatePath("/products");
  revalidatePath("/dashboard");
  return { ok: true as const, data };
}
