import type { Metadata } from "next";

import { auth } from "@/auth";
import { backendFetch } from "@/lib/api/server-fetch";
import type { OrderDto } from "@/lib/api/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { OrdersTable } from "./orders-table";

export const metadata: Metadata = {
  title: "Orders",
};

export default async function OrdersPage() {
  const session = await auth();
  let initial: OrderDto[] = [];
  if (session?.accessToken) {
    const res = await backendFetch("/api/admin/orders");
    if (res.ok) {
      initial = (await res.json()) as OrderDto[];
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Orders</h1>
        <p className="text-muted-foreground text-sm">
          Fulfilment and status updates.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Fulfilment</CardTitle>
          <CardDescription>
            Create orders for customers, advance status, or cancel per backend
            rules.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <OrdersTable initialData={initial} />
        </CardContent>
      </Card>
    </div>
  );
}
