"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Plus } from "lucide-react";
import { useSession } from "next-auth/react";

import { clientFetch } from "@/lib/api/client-fetch";
import type {
  CustomerRowDto,
  OrderDto,
  PaginatedCustomersDto,
  ProductDto,
} from "@/lib/api/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { CreateOrderDialog } from "@/app/(dashboard)/orders/create-order-dialog";

function formatInr(value: number): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value);
}

function orderTotal(o: OrderDto): number {
  return o.totalAmount ?? o.total ?? o.amount ?? 0;
}

function statusClass(status: string): string {
  switch (status) {
    case "RECEIVED":
      return "border-slate-300 bg-slate-100 text-slate-800";
    case "CONFIRMED":
      return "border-blue-300 bg-blue-100 text-blue-800";
    case "PACKED":
      return "border-violet-300 bg-violet-100 text-violet-800";
    case "DISPATCHED":
      return "border-amber-300 bg-amber-100 text-amber-800";
    case "DELIVERED":
      return "border-emerald-300 bg-emerald-100 text-emerald-800";
    case "CANCELLED":
      return "border-rose-300 bg-rose-100 text-rose-800";
    default:
      return "";
  }
}

export function DashboardActions({
  initialProducts,
}: {
  initialProducts: ProductDto[];
}) {
  const { status } = useSession();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = React.useState(false);

  const { data: products = initialProducts } = useQuery({
    queryKey: ["admin-products"],
    queryFn: async () => {
      const res = await clientFetch("/api/bff/admin/products");
      if (!res.ok) throw new Error("Failed to load products");
      return res.json() as Promise<ProductDto[]>;
    },
    initialData: initialProducts,
    enabled: status === "authenticated",
    staleTime: 60_000,
  });

  return (
    <>
      <Button type="button" size="sm" onClick={() => setCreateOpen(true)}>
        <Plus className="mr-2 size-4" />
        Create order
      </Button>
      <CreateOrderDialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) {
            queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
          }
        }}
        products={products}
      />
    </>
  );
}

export function DashboardLatestOrders({
  initialOrders,
}: {
  initialOrders: OrderDto[];
}) {
  const { status } = useSession();
  const { data: orders = initialOrders, isFetching } = useQuery({
    queryKey: ["admin-orders"],
    queryFn: async () => {
      const res = await clientFetch("/api/bff/admin/orders");
      if (!res.ok) throw new Error("Failed to load orders");
      return res.json() as Promise<OrderDto[]>;
    },
    initialData: initialOrders,
    enabled: status === "authenticated",
    refetchInterval: 25_000,
  });

  const recent = React.useMemo(
    () =>
      [...orders]
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
        .slice(0, 10),
    [orders]
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle>Latest orders</CardTitle>
          <CardDescription>
            Newest fulfilment activity
            {isFetching ? " · refreshing…" : ""}
          </CardDescription>
        </div>
        <Link href="/orders">
          <Button type="button" variant="outline" size="sm">
            View all
          </Button>
        </Link>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table className="min-w-[720px]">
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Delivery</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recent.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-muted-foreground h-24 text-center"
                  >
                    No orders yet.
                  </TableCell>
                </TableRow>
              ) : (
                recent.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="whitespace-nowrap text-sm">
                      {format(new Date(o.createdAt), "MMM d, HH:mm")}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm font-medium">
                        {o.user?.name ?? "—"}
                      </div>
                      <div className="text-muted-foreground font-mono text-xs">
                        {o.user?.phone ?? "—"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={statusClass(o.status)}
                      >
                        {o.statusLabel ?? o.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {(o.deliveryStatus ?? "NONE").replace(/_/g, " ")}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm tabular-nums">
                      {formatInr(orderTotal(o))}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

export function DashboardCustomersTable({
  initialCustomers,
}: {
  initialCustomers: CustomerRowDto[];
}) {
  const { status } = useSession();
  const { data, isFetching } = useQuery({
    queryKey: ["admin-customers", "dashboard"],
    queryFn: async () => {
      const res = await clientFetch(
        "/api/bff/admin/customers?page=1&limit=10"
      );
      if (!res.ok) throw new Error("Failed to load customers");
      return res.json() as Promise<PaginatedCustomersDto>;
    },
    initialData: {
      data: initialCustomers,
      total: initialCustomers.length,
      page: 1,
      limit: 10,
    },
    enabled: status === "authenticated",
    staleTime: 30_000,
  });

  const rows = data?.data ?? initialCustomers;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle>Customers</CardTitle>
          <CardDescription>
            Recent directory entries
            {isFetching ? " · refreshing…" : ""}
          </CardDescription>
        </div>
        <Link href="/customers">
          <Button type="button" variant="outline" size="sm">
            View all
          </Button>
        </Link>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table className="min-w-[640px]">
            <TableHeader>
              <TableRow>
                <TableHead>Phone</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Orders</TableHead>
                <TableHead>Addresses</TableHead>
                <TableHead>Joined</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-muted-foreground h-24 text-center"
                  >
                    No customers yet.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono text-sm">{c.phone}</TableCell>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="tabular-nums">
                      {c.orderCount ?? 0}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {c.addressCount ?? 0}
                    </TableCell>
                    <TableCell className="text-muted-foreground whitespace-nowrap text-sm">
                      {format(new Date(c.createdAt), "MMM d, yyyy")}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
