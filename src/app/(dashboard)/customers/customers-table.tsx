"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { IndianRupee, MapPin, ShoppingBag, Users, Wallet } from "lucide-react";

import type { CustomerRowDto, PaginatedCustomersDto } from "@/lib/api/types";
import { TableEmptyState } from "@/components/ui/data-table/table-empty-state";
import { TableFilterChips } from "@/components/ui/data-table/table-filter-chips";
import { TablePagination } from "@/components/ui/data-table/table-pagination";
import { TableSearchInput } from "@/components/ui/data-table/table-search-input";
import { TableStatCards } from "@/components/ui/data-table/table-stat-cards";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type QuickFilter = "all" | "with-deposit" | "no-deposit" | "with-orders";

function formatMoney(value: number): string {
  return `₹${value.toLocaleString("en-IN", {
    maximumFractionDigits: 0,
  })}`;
}

function depositOf(c: CustomerRowDto): number {
  return Number(c.depositBalance ?? 0);
}

function initials(name: string, phone: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0]!}${parts[1]![0]!}`.toUpperCase();
  }
  if (parts[0] && parts[0].length >= 2) return parts[0].slice(0, 2).toUpperCase();
  return phone.slice(-2);
}

export function CustomersTable({
  initialData,
}: {
  initialData: PaginatedCustomersDto | null;
}) {
  const [page, setPage] = React.useState(1);
  const [phoneInput, setPhoneInput] = React.useState("");
  const [nameInput, setNameInput] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [name, setName] = React.useState("");
  const [quickFilter, setQuickFilter] = React.useState<QuickFilter>("all");
  const limit = 20;

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      setPhone(phoneInput);
      setName(nameInput);
      setPage(1);
    }, 400);
    return () => window.clearTimeout(timer);
  }, [phoneInput, nameInput]);

  const useSsrSeed =
    page === 1 && !phone.trim() && !name.trim() && Boolean(initialData);

  const { data, isFetching, isLoading } = useQuery({
    queryKey: ["admin-customers", page, phone, name],
    queryFn: async () => {
      const q = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });
      if (phone.trim()) q.set("phone", phone.trim());
      if (name.trim()) q.set("name", name.trim());
      const res = await fetch(`/api/bff/admin/customers?${q.toString()}`);
      if (!res.ok) throw new Error("Failed to load customers");
      return res.json() as Promise<PaginatedCustomersDto>;
    },
    initialData: useSsrSeed ? (initialData ?? undefined) : undefined,
    initialDataUpdatedAt: useSsrSeed ? Date.now() : undefined,
  });

  const allRows = data?.data ?? [];
  const rows = React.useMemo(() => {
    if (quickFilter === "with-deposit") {
      return allRows.filter((c) => depositOf(c) > 0);
    }
    if (quickFilter === "no-deposit") {
      return allRows.filter((c) => depositOf(c) <= 0);
    }
    if (quickFilter === "with-orders") {
      return allRows.filter((c) => (c.orderCount ?? 0) > 0);
    }
    return allRows;
  }, [allRows, quickFilter]);

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const withOrders = allRows.filter((c) => (c.orderCount ?? 0) > 0).length;
  const withDeposit = allRows.filter((c) => depositOf(c) > 0).length;
  const pageDepositHeld = allRows.reduce((s, c) => s + depositOf(c), 0);

  const filterChips = [
    { id: "all" as const, label: "All", count: allRows.length },
    { id: "with-deposit" as const, label: "Holding deposit", count: withDeposit },
    {
      id: "no-deposit" as const,
      label: "No deposit",
      count: allRows.length - withDeposit,
    },
    { id: "with-orders" as const, label: "With orders", count: withOrders },
  ];

  return (
    <div className="space-y-5">
      <TableStatCards
        items={[
          { label: "Total customers", value: total, icon: Users },
          {
            label: "Holding deposit",
            value: withDeposit,
            icon: Wallet,
          },
          {
            label: "Deposit on this page",
            value: formatMoney(pageDepositHeld),
            icon: IndianRupee,
          },
          {
            label: "With orders",
            value: withOrders,
            icon: ShoppingBag,
          },
        ]}
      />

      <div className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <TableSearchInput
            value={nameInput}
            onChange={setNameInput}
            placeholder="Search by name…"
            aria-label="Search customers by name"
          />
          <div className="grid min-w-[12rem] gap-1.5">
            <Label htmlFor="f-phone" className="text-xs font-bold">
              Phone contains
            </Label>
            <Input
              id="f-phone"
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value)}
              placeholder="Filter by phone…"
              className="h-9 font-semibold"
            />
          </div>
        </div>

        <TableFilterChips
          chips={filterChips}
          activeId={quickFilter}
          onChange={(id) => setQuickFilter(id as QuickFilter)}
        />
      </div>

      {isLoading && allRows.length === 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="bg-muted/40 h-40 animate-pulse rounded-2xl border"
            />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <TableEmptyState
          icon={Users}
          title="No customers found"
          description={
            phoneInput || nameInput || quickFilter !== "all"
              ? "Try adjusting your search or filters."
              : "Customers will appear here once they register."
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-busy={isFetching}>
          {rows.map((c) => {
            const deposit = depositOf(c);
            const displayName = c.name?.trim() || "Unnamed customer";
            return (
              <article
                key={c.id}
                className="border-border bg-card relative overflow-hidden rounded-2xl border p-4 shadow-sm"
              >
                <div
                  className={cn(
                    "absolute top-3 bottom-3 left-0 w-1.5 rounded-r-full",
                    deposit > 0 ? "bg-sky-500" : "bg-slate-200",
                  )}
                  aria-hidden
                />
                <div className="flex items-start gap-3 pl-2">
                  <div className="bg-sky-50 text-sky-800 flex size-11 shrink-0 items-center justify-center rounded-xl text-sm font-extrabold tracking-tight">
                    {initials(displayName, c.phone)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-base font-extrabold tracking-tight">
                      {displayName}
                    </h2>
                    <p className="font-mono text-xs font-semibold text-slate-500">
                      {c.phone}
                    </p>
                  </div>
                </div>

                <div
                  className={cn(
                    "mt-4 flex items-end justify-between gap-3 rounded-xl px-3 py-2.5",
                    deposit > 0
                      ? "bg-sky-50 text-sky-950"
                      : "bg-muted/60 text-slate-600",
                  )}
                >
                  <div>
                    <p className="text-[10px] font-bold tracking-[0.12em] uppercase">
                      Deposit they hold
                    </p>
                    <p className="text-2xl font-extrabold tracking-tight tabular-nums">
                      {formatMoney(deposit)}
                    </p>
                  </div>
                  <Wallet
                    className={cn(
                      "mb-1 size-5",
                      deposit > 0 ? "text-sky-600" : "text-slate-400",
                    )}
                  />
                </div>

                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-slate-500">
                  <span className="inline-flex items-center gap-1">
                    <ShoppingBag className="size-3.5" />
                    {c.orderCount ?? 0} orders
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="size-3.5" />
                    {c.addressCount ?? 0} addresses
                  </span>
                  <span>
                    Joined {format(new Date(c.createdAt), "d MMM yyyy")}
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <TablePagination
        pageIndex={page - 1}
        pageCount={totalPages}
        pageSize={limit}
        totalItems={total}
        itemLabel="customer"
        isFetching={isFetching}
        onPrevious={() => setPage((p) => Math.max(1, p - 1))}
        onNext={() => setPage((p) => p + 1)}
        canPrevious={page > 1}
        canNext={page < totalPages}
      />
    </div>
  );
}
