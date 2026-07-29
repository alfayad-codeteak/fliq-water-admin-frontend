import type { Metadata } from "next";

import { auth } from "@/auth";
import { backendFetch } from "@/lib/api/server-fetch";
import type { OrderDto } from "@/lib/api/types";
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
      <OrdersTable initialData={initial} />
    </div>
  );
}
