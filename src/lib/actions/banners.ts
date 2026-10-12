"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { backendFetch } from "@/lib/api/server-fetch";
import { userFacingErrorFromResponse } from "@/lib/user-facing-error";

async function requireStaff() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  if (!["owner", "admin"].includes(session.user.role)) {
    throw new Error("Forbidden");
  }
  return session;
}

async function parseError(res: Response): Promise<string> {
  return userFacingErrorFromResponse(res);
}

export async function createBannerAction(formData: FormData) {
  await requireStaff();
  const res = await backendFetch("/api/admin/banners", {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    return { ok: false as const, error: await parseError(res) };
  }
  revalidatePath("/banners");
  return { ok: true as const };
}

export async function updateBannerAction(id: string, formData: FormData) {
  await requireStaff();
  const res = await backendFetch(`/api/admin/banners/${id}`, {
    method: "PATCH",
    body: formData,
  });
  if (!res.ok) {
    return { ok: false as const, error: await parseError(res) };
  }
  revalidatePath("/banners");
  return { ok: true as const };
}

export async function deleteBannerAction(id: string) {
  await requireStaff();
  const res = await backendFetch(`/api/admin/banners/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    return { ok: false as const, error: await parseError(res) };
  }
  revalidatePath("/banners");
  return { ok: true as const };
}
