"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { backendFetch } from "@/lib/api/server-fetch";
import { createAdminSchema, updateAdminSchema } from "@/lib/validations/user";

async function requireOwner() {
  const session = await auth();
  if (session?.user?.role !== "owner") {
    throw new Error("Forbidden");
  }
  return session;
}

export async function createAdminUser(formData: FormData) {
  await requireOwner();

  const permissionsRaw = formData.getAll("permissions") as string[];
  const raw = {
    phone: String(formData.get("phone") ?? ""),
    name: String(formData.get("name") ?? ""),
    password: String(formData.get("password") ?? ""),
    permissions: permissionsRaw.filter(Boolean),
  };

  const parsed = createAdminSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.flatten().fieldErrors };
  }

  const res = await backendFetch("/api/owner/admins", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(parsed.data),
  });

  if (res.status === 409) {
    return { ok: false as const, error: { phone: ["Phone already registered"] } };
  }
  if (!res.ok) {
    const text = await res.text();
    return {
      ok: false as const,
      error: { root: [text || `Error ${res.status}`] },
    };
  }

  revalidatePath("/users");
  return { ok: true as const };
}

export async function updateAdminAction(formData: FormData) {
  await requireOwner();

  const permissionsRaw = formData.getAll("permissions") as string[];
  const raw = {
    id: String(formData.get("id") ?? ""),
    name: formData.get("name") ? String(formData.get("name")) : undefined,
    password: formData.get("password")
      ? String(formData.get("password"))
      : "",
    permissions:
      permissionsRaw.length > 0 ? permissionsRaw.filter(Boolean) : undefined,
  };

  const parsed = updateAdminSchema.safeParse({
    ...raw,
    password: raw.password === "" ? undefined : raw.password,
  });
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.flatten().fieldErrors };
  }

  const { id, ...body } = parsed.data;
  const payload: Record<string, unknown> = {};
  if (body.name !== undefined) payload.name = body.name;
  if (body.password !== undefined) payload.password = body.password;
  if (body.permissions !== undefined) payload.permissions = body.permissions;

  const res = await backendFetch(`/api/owner/admins/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (res.status === 404) {
    return { ok: false as const, error: { id: ["Admin not found"] } };
  }
  if (!res.ok) {
    const text = await res.text();
    return {
      ok: false as const,
      error: { root: [text || `Error ${res.status}`] },
    };
  }

  revalidatePath("/users");
  return { ok: true as const };
}

export async function deleteAdminAction(id: string) {
  await requireOwner();

  if (!id?.trim()) {
    return { ok: false as const, error: "Invalid admin id" };
  }

  const res = await backendFetch(`/api/owner/admins/${id}`, {
    method: "DELETE",
  });

  if (res.status === 404) {
    return { ok: false as const, error: "Admin not found" };
  }
  if (!res.ok) {
    const text = await res.text();
    return {
      ok: false as const,
      error: text || `Error ${res.status}`,
    };
  }

  const data = (await res.json()) as { success?: boolean; id?: string };
  if (!data?.success || data.id !== id) {
    return {
      ok: false as const,
      error: "Unexpected delete response from server",
    };
  }

  revalidatePath("/users");
  return { ok: true as const };
}
