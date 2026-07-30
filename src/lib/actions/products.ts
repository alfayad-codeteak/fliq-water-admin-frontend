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

/**
 * Admin product write body. Prefer `salePrice`; keep `price` in sync.
 * Includes optional `mrp` and `handlingFee` (catalog).
 */
function toProductWriteBody(data: {
  name?: string;
  salePrice?: number;
  price?: number;
  mrp?: number | null;
  handlingFee?: number;
  stock?: number;
  hasDeposit?: boolean;
  photoUrl?: string;
  photoUrls?: string[];
  category?: string;
  isActive?: boolean;
}): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  if (data.name !== undefined) body.name = data.name;
  const sale = data.salePrice ?? data.price;
  if (sale !== undefined) {
    body.salePrice = sale;
    body.price = sale;
  }
  if (data.mrp !== undefined) body.mrp = data.mrp;
  if (data.handlingFee !== undefined) body.handlingFee = data.handlingFee;
  if (data.stock !== undefined) body.stock = data.stock;
  if (data.hasDeposit !== undefined) body.hasDeposit = data.hasDeposit;
  if (data.photoUrl !== undefined) body.photoUrl = data.photoUrl;
  if (data.photoUrls !== undefined) body.photoUrls = data.photoUrls;
  if (data.category !== undefined) body.category = data.category;
  if (data.isActive !== undefined) body.isActive = data.isActive;
  return body;
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
      payloads.push(toProductWriteBody(parsedItem.data));
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

  const salePriceRaw =
    formData.get("salePrice") ?? formData.get("price");

  const raw = {
    name: String(formData.get("name") ?? ""),
    salePrice: salePriceRaw,
    price: salePriceRaw,
    mrp: formData.get("mrp"),
    handlingFee: formData.get("handlingFee"),
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

  const body = toProductWriteBody(parsed.data);

  const res = await backendFetch("/api/admin/products", {
    method: "POST",
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

export async function updateProductAction(formData: FormData) {
  await requireStaff();

  const activeRaw = formData.get("isActive");
  const isActive =
    activeRaw == null
      ? undefined
      : activeRaw === "on" || activeRaw === "true";

  const salePriceRaw =
    formData.get("salePrice") ?? formData.get("price");
  const mrpRaw = formData.get("mrp");
  const mrpProvided = formData.has("mrp");

  const raw = {
    id: String(formData.get("id") ?? ""),
    name: String(formData.get("name") ?? ""),
    salePrice: salePriceRaw,
    price: salePriceRaw,
    mrp: mrpProvided
      ? String(mrpRaw ?? "").trim() === ""
        ? null
        : mrpRaw
      : undefined,
    handlingFee: formData.get("handlingFee"),
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
    salePrice: raw.salePrice ?? undefined,
    price: raw.price ?? undefined,
    mrp: raw.mrp ?? undefined,
    handlingFee: raw.handlingFee ?? undefined,
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
  const body = toProductWriteBody(patch);

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
    body: JSON.stringify({ items: parsed.data.items }),
  });

  if (res.ok) {
    const data = (await res.json()) as BulkUpdateProductsResponseDto;
    revalidatePath("/products");
    revalidatePath("/dashboard");
    return { ok: true, data };
  }

  const text = await res.text();
  const looksLikeWhitelistReject =
    /salePrice|mrp|handlingFee/i.test(text) &&
    /should not exist/i.test(text);

  // Fallback: single-product PATCH when bulk DTO still rejects pricing fields.
  if (looksLikeWhitelistReject) {
    const updated: BulkUpdateProductsResponseDto["products"] = [];
    for (const item of parsed.data.items) {
      const body = toProductWriteBody({
        salePrice: item.salePrice ?? item.price,
        price: item.price ?? item.salePrice,
        mrp: item.mrp,
        handlingFee: item.handlingFee,
        stock: item.stock,
      });
      const one = await backendFetch(`/api/admin/products/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!one.ok) {
        const errText = await one.text();
        return {
          ok: false,
          error: { root: [errText || `Error ${one.status}`] },
        };
      }
      try {
        updated.push((await one.json()) as BulkUpdateProductsResponseDto["products"][number]);
      } catch {
        // ignore empty body
      }
    }
    revalidatePath("/products");
    revalidatePath("/dashboard");
    return {
      ok: true,
      data: { count: parsed.data.items.length, products: updated },
    };
  }

  return {
    ok: false,
    error: { root: [text || `Error ${res.status}`] },
  };
}

export async function toggleProductActiveAction(
  id: string,
  isActive: boolean
) {
  await requireStaff();

  if (!id?.trim()) {
    return { ok: false as const, error: "Invalid product id" };
  }

  const res = await backendFetch(`/api/admin/products/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ isActive }),
  });

  if (!res.ok) {
    const text = await res.text();
    return {
      ok: false as const,
      error: text || `Error ${res.status}`,
    };
  }

  revalidatePath("/products");
  revalidatePath("/dashboard");
  return { ok: true as const };
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
