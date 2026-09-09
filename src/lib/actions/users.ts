"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { backendFetch } from "@/lib/api/server-fetch";
import { createAdminSchema, updateAdminSchema } from "@/lib/validations/user";

function firstError(error: unknown): string {
  if (!error) return "Request failed";
  if (typeof error === "string") return error;
  if (Array.isArray(error)) {
    const parts = error.filter((e): e is string => typeof e === "string");
    if (parts.length) return parts.join(" ");
  }
  if (typeof error === "object") {
    const rec = error as Record<string, unknown>;
    if (typeof rec.message === "string") return rec.message;
    if (Array.isArray(rec.message)) return firstError(rec.message);
    const fieldBags = Object.values(rec).flatMap((v) =>
      Array.isArray(v) ? v : typeof v === "string" ? [v] : [],
    );
    if (fieldBags.length) return fieldBags.join(" ");
  }
  return "Request failed";
}

async function readApiError(res: Response): Promise<string> {
  const text = await res.text();
  if (!text) return `Error ${res.status}`;
  try {
    return firstError(JSON.parse(text));
  } catch {
    return text.slice(0, 280);
  }
}

function digitsPhone(raw: string): string {
  return raw.replace(/\D/g, "").slice(-10);
}

async function requireOwner() {
  const session = await auth();
  if (session?.user?.role !== "owner") {
    return { ok: false as const, error: "Only the owner can create or manage admins" };
  }
  return { ok: true as const, session };
}

export async function createAdminUser(formData: FormData) {
  const gate = await requireOwner();
  if (!gate.ok) return gate;

  const permissionsRaw = formData.getAll("permissions") as string[];
  const raw = {
    phone: digitsPhone(String(formData.get("phone") ?? "")),
    name: String(formData.get("name") ?? "").trim(),
    password: String(formData.get("password") ?? ""),
    permissions: permissionsRaw.filter(Boolean),
  };

  const parsed = createAdminSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false as const, error: firstError(parsed.error.flatten().fieldErrors) };
  }

  const res = await backendFetch("/api/owner/admins", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(parsed.data),
  });

  if (res.status === 409) {
    return { ok: false as const, error: "Phone already registered" };
  }
  if (!res.ok) {
    return { ok: false as const, error: await readApiError(res) };
  }

  revalidatePath("/users");
  return { ok: true as const };
}

export async function updateAdminAction(formData: FormData) {
  const gate = await requireOwner();
  if (!gate.ok) return gate;

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
    return { ok: false as const, error: firstError(parsed.error.flatten().fieldErrors) };
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
    return { ok: false as const, error: "Admin not found" };
  }
  if (!res.ok) {
    return { ok: false as const, error: await readApiError(res) };
  }

  revalidatePath("/users");
  return { ok: true as const };
}

export async function deleteAdminAction(id: string) {
  const gate = await requireOwner();
  if (!gate.ok) return gate;

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
