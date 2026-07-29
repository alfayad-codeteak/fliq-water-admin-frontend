import type { Metadata } from "next";

import { auth } from "@/auth";
import { backendFetch } from "@/lib/api/server-fetch";
import type { DepositConfigDto, ProductDto } from "@/lib/api/types";
import { ProductsTable } from "./products-table";

export const metadata: Metadata = {
  title: "Products",
};

export default async function ProductsPage() {
  const session = await auth();
  let initialData: ProductDto[] = [];
  let depositConfig: DepositConfigDto | null = null;
  if (session?.accessToken) {
    const [productsRes, configRes] = await Promise.all([
      backendFetch("/api/admin/products"),
      backendFetch("/api/deposits/config"),
    ]);
    if (productsRes.ok) {
      initialData = (await productsRes.json()) as ProductDto[];
    }
    if (configRes.ok) {
      depositConfig = (await configRes.json()) as DepositConfigDto;
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Products</h1>
        <p className="text-muted-foreground text-sm">
          Manage your catalog, pricing, stock, and visibility.
        </p>
      </div>
      <ProductsTable initialData={initialData} depositConfig={depositConfig} />
    </div>
  );
}
