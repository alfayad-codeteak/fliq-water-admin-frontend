"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { backendFetch } from "@/lib/api/server-fetch";
import type {
  BulkUpdateProductsRequestDto,
  BulkUpdateProductsResponseDto,
} from "@/lib/api/types";
import { safeParseBulkProductItem } from "@/lib/products/bulk-product-json";
import {
  bulkUpdateProductsSchema,
  createProductSchema,
  updateProductSchema,
} from "@/lib/validations/product";

function parsePhotoUrlsFromFormData(formData: FormData): string[] {
  return formData
    .getAll("photoUrls")
    .map((entry) => String(entry ?? "").trim())
    .filter(Boolean);
}

async function requireStaff() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session;
}

export async function createProductAction(formData: FormData) {
  await requireStaff();

  const submitMode = String(formData.get("submitMode") ?? "single");
  const bulkProductsJson = String(formData.get("bulkProductsJson") ?? "").trim();
  if (submitMode === "bulk") {
    if (!bulkProductsJson) {
      return {
        ok: false as const,
        error: { root: ["Paste JSON before using Bulk Create"] },
      };
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(bulkProductsJson);
    } catch {
      return {
        ok: false as const,
        error: { root: ["Invalid JSON in bulk products field"] },
      };
    }

    if (!Array.isArray(parsedJson) || parsedJson.length === 0) {
      return {
        ok: false as const,
        error: { root: ["Bulk JSON must be a non-empty array of products"] },
      };
    }

    const payloads: Array<Record<string, unknown>> = [];
    for (const item of parsedJson) {
      const parsedItem = safeParseBulkProductItem(item);
      if (!parsedItem.success) {
        return {
          ok: false as const,
          error: {
            root: [`Bulk JSON row invalid: ${parsedItem.error}`],
          },
        };
      }
      payloads.push(parsedItem.data);
    }

    for (const payload of payloads) {
      const res = await backendFetch("/api/admin/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const text = await res.text();
        return {
          ok: false as const,
          error: { root: [text || `Error ${res.status}`] },
        };
      }
    }

    revalidatePath("/products");
    revalidatePath("/dashboard");
    return { ok: true as const, createdCount: payloads.length };
  }

  const raw = {
    name: String(formData.get("name") ?? ""),
    price: formData.get("price"),
    stock: formData.get("stock"),
    hasDeposit: String(formData.get("hasDeposit") ?? "true") === "true",
    photoUrl: String(formData.get("photoUrl") ?? "").trim(),
    photoUrls: parsePhotoUrlsFromFormData(formData),
    category: String(formData.get("category") ?? ""),
  };

  const resolvedPhotoUrls = raw.photoUrls.length
    ? raw.photoUrls
    : raw.photoUrl
      ? [raw.photoUrl]
      : [];
  const resolvedPhotoUrl = resolvedPhotoUrls[0];

  const parsed = createProductSchema.safeParse({
    ...raw,
    hasDeposit: raw.hasDeposit,
    photoUrl: resolvedPhotoUrl || undefined,
    photoUrls: resolvedPhotoUrls.length ? resolvedPhotoUrls : undefined,
    category: raw.category || undefined,
  });
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.flatten().fieldErrors };
  }

  const res = await backendFetch("/api/admin/products", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(parsed.data),
  });

  if (!res.ok) {
    const text = await res.text();
    return {
      ok: false as const,
      error: { root: [text || `Error ${res.status}`] },
    };
  }

  revalidatePath("/products");
  revalidatePath("/dashboard");
  return { ok: true as const };
}

export async function updateProductAction(formData: FormData) {
  await requireStaff();

  const activeRaw = formData.get("isActive");
  const isActive =
    activeRaw == null
      ? undefined
      : activeRaw === "on" || activeRaw === "true";

  const raw = {
    id: String(formData.get("id") ?? ""),
    name: String(formData.get("name") ?? ""),
    price: formData.get("price"),
    stock: formData.get("stock"),
    hasDeposit: String(formData.get("hasDeposit") ?? "true") === "true",
    photoUrl: String(formData.get("photoUrl") ?? "").trim(),
    photoUrls: parsePhotoUrlsFromFormData(formData),
    category: String(formData.get("category") ?? ""),
    isActive,
  };

  const resolvedPhotoUrls = raw.photoUrls.length
    ? raw.photoUrls
    : raw.photoUrl
      ? [raw.photoUrl]
      : [];
  const resolvedPhotoUrl = resolvedPhotoUrls[0];

  const parsed = updateProductSchema.safeParse({
    id: raw.id,
    name: raw.name || undefined,
    price: raw.price ?? undefined,
    stock: raw.stock ?? undefined,
    hasDeposit: raw.hasDeposit,
    photoUrl: resolvedPhotoUrl || undefined,
    photoUrls: resolvedPhotoUrls.length ? resolvedPhotoUrls : undefined,
    category: raw.category || undefined,
    isActive: raw.isActive,
  });
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.flatten().fieldErrors };
  }

  const { id, ...patch } = parsed.data;
  const body: Record<string, unknown> = {};
  if (patch.name !== undefined) body.name = patch.name;
  if (patch.price !== undefined) body.price = patch.price;
  if (patch.stock !== undefined) body.stock = patch.stock;
  if (patch.photoUrl !== undefined) body.photoUrl = patch.photoUrl;
  if (patch.photoUrls !== undefined) body.photoUrls = patch.photoUrls;
  if (patch.category !== undefined) body.category = patch.category;
  if (patch.isActive !== undefined) body.isActive = patch.isActive;
  if (patch.hasDeposit !== undefined) body.hasDeposit = patch.hasDeposit;

  const res = await backendFetch(`/api/admin/products/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    return {
      ok: false as const,
      error: { root: [text || `Error ${res.status}`] },
    };
  }

  revalidatePath("/products");
  revalidatePath("/dashboard");
  return { ok: true as const };
}

export async function bulkUpdateProductsAction(
  payload: BulkUpdateProductsRequestDto
): Promise<
  | { ok: true; data: BulkUpdateProductsResponseDto }
  | { ok: false; error: { root: string[] } | Record<string, string[]> }
> {
  await requireStaff();

  const parsed = bulkUpdateProductsSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.flatten().fieldErrors };
  }

  const res = await backendFetch("/api/admin/products/bulk", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(parsed.data),
  });

  if (!res.ok) {
    const text = await res.text();
    return {
      ok: false,
      error: { root: [text || `Error ${res.status}`] },
    };
  }

  const data = (await res.json()) as BulkUpdateProductsResponseDto;
  revalidatePath("/products");
  revalidatePath("/dashboard");
  return { ok: true, data };
}

export async function deleteProductAction(id: string) {
  await requireStaff();

  if (!id?.trim()) {
    return { ok: false as const, error: "Invalid product id" };
  }

  const res = await backendFetch(`/api/admin/products/${id}`, {
    method: "DELETE",
  });

  if (res.status === 404) {
    return { ok: false as const, error: "Product not found" };
  }
  if (res.status === 400 || res.status === 409) {
    return {
      ok: false as const,
      error: "Product is used in orders and cannot be deleted",
    };
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

  revalidatePath("/products");
  revalidatePath("/dashboard");
  return { ok: true as const };
}
