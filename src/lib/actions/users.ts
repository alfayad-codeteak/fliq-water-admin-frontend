"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { backendFetch } from "@/lib/api/server-fetch";
import {
  createAdminSchema,
  createOwnerSchema,
  updateAdminSchema,
} from "@/lib/validations/user";
import {
  userFacingError,
  userFacingErrorFromResponse,
} from "@/lib/user-facing-error";

function firstError(error: unknown): string {
  return userFacingError(error, "Please check the details and try again.");
}

async function readApiError(res: Response): Promise<string> {
  return userFacingErrorFromResponse(res);
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

  const accountRole =
    String(formData.get("role") ?? "admin") === "owner" ? "owner" : "admin";
  const base = {
    phone: digitsPhone(String(formData.get("phone") ?? "")),
    name: String(formData.get("name") ?? "").trim(),
    password: String(formData.get("password") ?? ""),
  };

  if (accountRole === "owner") {
    const parsed = createOwnerSchema.safeParse(base);
    if (!parsed.success) {
      return { ok: false as const, error: firstError(parsed.error.flatten().fieldErrors) };
    }
    const res = await backendFetch("/api/owner/owners", {
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

  const permissionsRaw = formData.getAll("permissions") as string[];
  const parsed = createAdminSchema.safeParse({
    ...base,
    permissions: permissionsRaw.filter(Boolean),
  });
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
    return {
      ok: false as const,
      error: await userFacingErrorFromResponse(res),
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
