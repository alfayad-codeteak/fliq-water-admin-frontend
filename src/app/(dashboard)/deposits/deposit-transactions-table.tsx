"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Receipt } from "lucide-react";

import { clientFetch } from "@/lib/api/client-fetch";
import type { DepositTransactionDto } from "@/lib/api/types";
import { TableEmptyState } from "@/components/ui/data-table/table-empty-state";
import { TableFilterChips } from "@/components/ui/data-table/table-filter-chips";
import { TableSearchInput } from "@/components/ui/data-table/table-search-input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

type KindFilter = "all" | "returned" | "added" | "held";

const TITLES: Record<string, string> = {
  ADMIN_DEBIT: "Deposit returned",
  REFUND: "Cans returned",
  ADMIN_CREDIT: "Deposit added",
  TOP_UP: "Wallet top-up",
  CHARGE: "Deposit charged",
};

function titleFor(type: string): string {
  return TITLES[type] ?? type.replace(/_/g, " ");
}

function isReturned(type: string): boolean {
  return type === "ADMIN_DEBIT" || type === "REFUND";
}

function isAdded(type: string): boolean {
  return type === "ADMIN_CREDIT" || type === "TOP_UP";
}

function formatMoney(value: number): string {
  return `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

export function DepositTransactionsTable({
  rows: initialRows,
}: {
  rows: DepositTransactionDto[];
}) {
  const { data: rows = initialRows } = useQuery({
    queryKey: ["admin-deposit-transactions"],
    queryFn: async () => {
      const res = await clientFetch("/api/bff/admin/deposits/transactions");
      if (!res.ok) throw new Error("Failed to load deposit transactions");
      return (await res.json()) as DepositTransactionDto[];
    },
    initialData: initialRows,
    refetchInterval: 15_000,
  });
  const [query, setQuery] = React.useState("");
  const [kind, setKind] = React.useState<KindFilter>("all");

  const filtered = React.useMemo(() => {
    const term = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (kind === "returned" && !isReturned(row.type)) return false;
      if (kind === "added" && !isAdded(row.type)) return false;
      if (kind === "held" && row.type !== "CHARGE") return false;
      if (!term) return true;
      return (
        row.customerName.toLowerCase().includes(term) ||
        row.phone.toLowerCase().includes(term) ||
        titleFor(row.type).toLowerCase().includes(term) ||
        (row.note ?? "").toLowerCase().includes(term)
      );
    });
  }, [rows, query, kind]);

  const returnedCount = rows.filter((r) => isReturned(r.type)).length;
  const addedCount = rows.filter((r) => isAdded(r.type)).length;
  const heldCount = rows.filter((r) => r.type === "CHARGE").length;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <TableSearchInput
          value={query}
          onChange={setQuery}
          placeholder="Search name, phone, or note"
          aria-label="Search deposit transactions"
        />
        <TableFilterChips
          activeId={kind}
          onChange={(id) => setKind(id as KindFilter)}
          chips={[
            { id: "all", label: "All", count: rows.length },
            { id: "returned", label: "Returned", count: returnedCount },
            { id: "added", label: "Added", count: addedCount },
            { id: "held", label: "Deposit charged", count: heldCount },
          ]}
        />
      </div>

      {filtered.length === 0 ? (
        <TableEmptyState
          icon={Receipt}
          title="No deposit transactions"
          description={
            query || kind !== "all"
              ? "Try adjusting your search or filters."
              : "Credits, returns, and order holds will show up here."
          }
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Note</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((row) => {
              const returned = isReturned(row.type);
              return (
                <TableRow key={row.id}>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {format(new Date(row.createdAt), "d MMM yyyy, h:mm a")}
                  </TableCell>
                  <TableCell>
                    <p className="font-semibold">
                      {row.customerName.trim() || "Unnamed customer"}
                    </p>
                    <p className="font-mono text-xs text-muted-foreground">
                      {row.phone}
                    </p>
                  </TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        "inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold",
                        returned
                          ? "bg-emerald-50 text-emerald-800"
                          : isAdded(row.type)
                            ? "bg-sky-50 text-sky-800"
                            : "bg-slate-100 text-slate-700",
                      )}
                    >
                      {titleFor(row.type)}
                    </span>
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-right font-extrabold tabular-nums",
                      returned ? "text-emerald-700" : "text-slate-900",
                    )}
                  >
                    {returned ? "−" : "+"}
                    {formatMoney(row.amount)}
                  </TableCell>
                  <TableCell className="max-w-[220px] truncate text-muted-foreground">
                    {row.note || "—"}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
