import type { Metadata } from "next";

import { auth } from "@/auth";
import { backendFetch } from "@/lib/api/server-fetch";
import type { ProductDto } from "@/lib/api/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ProductsTable } from "./products-table";

export const metadata: Metadata = {
  title: "Products",
};

export default async function ProductsPage() {
  const session = await auth();
  let initialData: ProductDto[] = [];
  if (session?.accessToken) {
    const res = await backendFetch("/api/admin/products");
    if (res.ok) {
      initialData = (await res.json()) as ProductDto[];
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Products</h1>
        <p className="text-muted-foreground text-sm">
          Manage catalog items and visibility.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Catalog</CardTitle>
          <CardDescription>
            Create and update items; visibility uses{" "}
            <code className="text-xs">isActive</code>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProductsTable initialData={initialData} />
        </CardContent>
      </Card>
    </div>
  );
}
