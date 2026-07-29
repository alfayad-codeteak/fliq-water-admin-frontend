import type { Metadata } from "next";

import { auth } from "@/auth";
import { backendFetch } from "@/lib/api/server-fetch";
import type { PurchaseEntryDto } from "@/lib/api/types";
import { PurchaseEntriesTable } from "./purchase-entries-table";

export const metadata: Metadata = {
  title: "Purchase entries",
};

export default async function PurchaseEntriesPage() {
  const session = await auth();
  let initial: PurchaseEntryDto[] = [];
  if (session?.accessToken) {
    const res = await backendFetch("/api/admin/purchase-entries");
    if (res.ok) {
      initial = (await res.json()) as PurchaseEntryDto[];
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Purchase entries
        </h1>
        <p className="text-muted-foreground text-sm">
          Record stock purchased from suppliers. Each line increases product
          inventory.
        </p>
      </div>
      <PurchaseEntriesTable initialData={initial} />
    </div>
  );
}
