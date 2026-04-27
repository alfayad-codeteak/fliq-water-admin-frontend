import type { Metadata } from "next";
import { format, subDays } from "date-fns";

import { auth } from "@/auth";
import { backendFetch } from "@/lib/api/server-fetch";
import type { OrderDto, ProductDto } from "@/lib/api/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DashboardBarChart, DashboardLineChart } from "./dashboard-charts";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default async function DashboardPage() {
  const session = await auth();
  let products: ProductDto[] = [];
  let orders: OrderDto[] = [];
  let customerTotal = 0;

  if (session?.accessToken) {
    const [pr, or, cr] = await Promise.all([
      backendFetch("/api/admin/products"),
      backendFetch("/api/admin/orders"),
      backendFetch("/api/admin/customers?page=1&limit=1"),
    ]);
    if (pr.ok) products = (await pr.json()) as ProductDto[];
    if (or.ok) orders = (await or.json()) as OrderDto[];
    if (cr.ok) {
      const body = (await cr.json()) as { total?: number };
      customerTotal = body.total ?? 0;
    }
  }

  const productCount = products.length;
  const activeProducts = products.filter((p) => p.isActive !== false).length;
  const lowStock = products.filter(
    (p) => p.isActive !== false && (p.stock ?? 0) < 20
  ).length;
  const orderCount = orders.length;

  const lineData = Array.from({ length: 7 }, (_, i) => {
    const day = subDays(new Date(), 6 - i);
    return {
      label: format(day, "EEE"),
      value: Math.max(
        2,
        Math.round(orderCount + productCount * 0.3 + i * 2)
      ),
    };
  });

  const barData = Array.from({ length: 5 }, (_, i) => ({
    label: `W${i + 1}`,
    value: Math.max(4, Math.round(productCount * (1.1 + i * 0.25))),
  }));

  const recentOrders = [...orders]
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
    .slice(0, 8);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Welcome{session?.user?.name ? `, ${session.user.name}` : ""}
        </h1>
        <p className="text-muted-foreground text-sm">
          Live counts from your connected backend.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Customers (total)</CardDescription>
            <CardTitle className="text-3xl tabular-nums">
              {customerTotal}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground text-xs">
            Total registered customers
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Products</CardDescription>
            <CardTitle className="text-3xl tabular-nums">
              {productCount}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground text-xs">
            {activeProducts} active in catalog
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Low stock (&lt; 20)</CardDescription>
            <CardTitle className="text-3xl tabular-nums">{lowStock}</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground text-xs">
            Active products below threshold
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Orders (loaded)</CardDescription>
            <CardTitle className="text-3xl tabular-nums">{orderCount}</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground text-xs">
            Orders loaded in this session
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Activity index</CardTitle>
            <CardDescription>Illustrative series from live totals</CardDescription>
          </CardHeader>
          <CardContent>
            <DashboardLineChart data={lineData} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Throughput</CardTitle>
            <CardDescription>Weekly-style bars</CardDescription>
          </CardHeader>
          <CardContent>
            <DashboardBarChart data={barData} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent orders</CardTitle>
          <CardDescription>Newest from the loaded order list</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentOrders.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={3}
                    className="text-muted-foreground h-24 text-center"
                  >
                    No orders to show yet.
                  </TableCell>
                </TableRow>
              ) : (
                recentOrders.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="whitespace-nowrap text-sm">
                      {format(new Date(o.createdAt), "MMM d, HH:mm")}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {o.user?.name ?? "—"}{" "}
                        <span className="text-muted-foreground font-mono text-xs">
                          {o.user?.phone}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>{o.statusLabel ?? o.status}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
