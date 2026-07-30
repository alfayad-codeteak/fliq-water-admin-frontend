import type { ProductDto } from "@/lib/api/types";

/** Sale price used in orders — prefer `salePrice`, fall back to `price`. */
export function productSalePrice(
  p: Pick<ProductDto, "price" | "salePrice">
): number {
  if (typeof p.salePrice === "number" && Number.isFinite(p.salePrice)) {
    return p.salePrice;
  }
  return p.price;
}

export function productMrp(p: Pick<ProductDto, "mrp">): number | null {
  if (typeof p.mrp === "number" && Number.isFinite(p.mrp)) return p.mrp;
  return null;
}

export function productHandlingFee(
  p: Pick<ProductDto, "handlingFee">
): number {
  if (typeof p.handlingFee === "number" && Number.isFinite(p.handlingFee)) {
    return p.handlingFee;
  }
  return 0;
}
