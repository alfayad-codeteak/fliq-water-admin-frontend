import { createProductSchema } from "@/lib/validations/product";
import type { z, ZodError } from "zod";

export type ParsedBulkProduct = z.infer<typeof createProductSchema>;

function formatBulkPreviewIssues(err: ZodError): string {
  return err.issues.map((i) => i.message).join("; ");
}

/** Normalization for bulk JSON rows — must match `createProductAction` bulk branch. */
function normalizeBulkProductSource(
  source: Record<string, unknown>
): Record<string, unknown> {
  const itemPhotoUrl =
    typeof source.photoUrl === "string" ? source.photoUrl.trim() : "";
  const itemPhotoUrls = Array.isArray(source.photoUrls)
    ? source.photoUrls
        .map((v) => (typeof v === "string" ? v.trim() : ""))
        .filter(Boolean)
    : [];
  const resolvedPhotoUrls = itemPhotoUrls.length
    ? itemPhotoUrls
    : itemPhotoUrl
      ? [itemPhotoUrl]
      : [];

  // Prefer salePrice when both are present (API write contract).
  const salePrice =
    source.salePrice !== undefined && source.salePrice !== null
      ? source.salePrice
      : source.price;

  return {
    name: source.name,
    salePrice,
    price: salePrice,
    mrp: source.mrp,
    handlingFee: source.handlingFee,
    stock: source.stock,
    hasDeposit:
      typeof source.hasDeposit === "boolean" ? source.hasDeposit : undefined,
    photoUrl: resolvedPhotoUrls[0] || undefined,
    photoUrls: resolvedPhotoUrls.length ? resolvedPhotoUrls : undefined,
    category:
      typeof source.category === "string" && source.category.trim()
        ? source.category.trim()
        : undefined,
  };
}

export function safeParseBulkProductItem(
  item: unknown
):
  | { success: true; data: ParsedBulkProduct }
  | { success: false; error: string } {
  if (!item || typeof item !== "object") {
    return { success: false, error: "Each entry must be an object" };
  }
  const r = createProductSchema.safeParse(
    normalizeBulkProductSource(item as Record<string, unknown>)
  );
  if (!r.success) {
    return { success: false, error: formatBulkPreviewIssues(r.error) };
  }
  return { success: true, data: r.data };
}
