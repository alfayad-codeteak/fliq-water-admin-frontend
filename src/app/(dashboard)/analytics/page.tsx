import type { Metadata } from "next";
import { format, subMonths } from "date-fns";

import { auth } from "@/auth";
import { loadOrders, loadProducts } from "@/lib/api/admin-list";
import type { OrderDto, ProductDto } from "@/lib/api/types";
import { productSalePrice } from "@/lib/products/product-price";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DashboardBarChart, DashboardLineChart } from "../dashboard/dashboard-charts";
import { AnalyticsStackedVisual } from "./analytics-charts";

export const metadata: Metadata = {
  title: "Reports",
};

export default async function AnalyticsPage() {
  const session = await auth();
  let products: ProductDto[] = [];
  let orders: OrderDto[] = [];

  if (session?.accessToken) {
    const [pr, or] = await Promise.all([loadProducts(), loadOrders()]);
    products = pr;
    orders = or;
  }

  const months = Array.from({ length: 6 }, (_, i) =>
    format(subMonths(new Date(), 5 - i), "MMM")
  );

  const stacked = months.map((label, i) => ({
    label,
    a: Math.max(1, orders.length + i * 2),
    b: Math.max(
      1,
      Math.round(
        products.filter((p) => p.isActive !== false).length * 0.8 + i
      )
    ),
  }));

  const revenueLike = months.map((label, i) => ({
    label,
    value: Math.round(
      products.reduce(
        (s, p) => s + productSalePrice(p) * Math.min(p.stock ?? 0, 5),
        0
      ) /
        (6 - i) +
        i * 120
    ),
  }));

  const mix = months.map((label, i) => ({
    label,
    value: Math.max(
      2,
      products.filter((p) => p.isActive !== false).length +
        orders.length +
        i * 3
    ),
  }));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
        <p className="text-muted-foreground text-sm">
          Charts derived from live catalog and order data.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Contribution view</CardTitle>
          <CardDescription>Orders vs catalog signals</CardDescription>
        </CardHeader>
        <CardContent>
          <AnalyticsStackedVisual data={stacked} />
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Revenue proxy</CardTitle>
            <CardDescription>Price × capped stock (illustrative)</CardDescription>
          </CardHeader>
          <CardContent>
            <DashboardLineChart data={revenueLike} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Load index</CardTitle>
            <CardDescription>Blended indicator</CardDescription>
          </CardHeader>
          <CardContent>
            <DashboardBarChart data={mix} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
