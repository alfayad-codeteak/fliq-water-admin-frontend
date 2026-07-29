"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { MapPin, ShoppingBag, Users } from "lucide-react";

import type { PaginatedCustomersDto } from "@/lib/api/types";
import { TableEmptyState } from "@/components/ui/data-table/table-empty-state";
import { TableFilterChips } from "@/components/ui/data-table/table-filter-chips";
import { TablePagination } from "@/components/ui/data-table/table-pagination";
import { TableSearchInput } from "@/components/ui/data-table/table-search-input";
import { TableSkeletonRows } from "@/components/ui/data-table/table-skeleton-rows";
import { TableStatCards } from "@/components/ui/data-table/table-stat-cards";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type QuickFilter = "all" | "with-orders" | "no-orders";

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
    initialData: initialData ?? undefined,
  });

  const allRows = data?.data ?? [];
  const rows = React.useMemo(() => {
    if (quickFilter === "with-orders") {
      return allRows.filter((c) => (c.orderCount ?? 0) > 0);
    }
    if (quickFilter === "no-orders") {
      return allRows.filter((c) => (c.orderCount ?? 0) === 0);
    }
    return allRows;
  }, [allRows, quickFilter]);

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const withOrders = allRows.filter((c) => (c.orderCount ?? 0) > 0).length;
  const totalAddresses = allRows.reduce((s, c) => s + (c.addressCount ?? 0), 0);

  const filterChips = [
    { id: "all" as const, label: "All", count: allRows.length },
    { id: "with-orders" as const, label: "With orders", count: withOrders },
    {
      id: "no-orders" as const,
      label: "No orders",
      count: allRows.length - withOrders,
    },
  ];

  return (
    <div className="space-y-5">
      <TableStatCards
        items={[
          { label: "Total customers", value: total, icon: Users },
          {
            label: "On this page",
            value: allRows.length,
            icon: Users,
          },
          {
            label: "With orders",
            value: withOrders,
            icon: ShoppingBag,
          },
          {
            label: "Addresses (page)",
            value: totalAddresses,
            icon: MapPin,
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
            <Label htmlFor="f-phone" className="text-xs">
              Phone contains
            </Label>
            <Input
              id="f-phone"
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value)}
              placeholder="Filter by phone…"
              className="h-9"
            />
          </div>
        </div>

        <TableFilterChips
          chips={filterChips}
          activeId={quickFilter}
          onChange={(id) => setQuickFilter(id as QuickFilter)}
        />
      </div>

      <div className="space-y-3">
        <div className="overflow-x-auto">
          <Table className="min-w-[920px]" aria-busy={isFetching}>
            <TableHeader className="bg-muted/40 sticky top-0 z-10 backdrop-blur-sm">
              <TableRow className="hover:bg-transparent">
                <TableHead className="h-11 text-xs">Phone</TableHead>
                <TableHead className="h-11 text-xs">Name</TableHead>
                <TableHead className="h-11 text-xs">Orders</TableHead>
                <TableHead className="h-11 text-xs">Addresses</TableHead>
                <TableHead className="h-11 text-xs">Joined</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && allRows.length === 0 ? (
                <TableSkeletonRows colSpan={5} />
              ) : rows.length ? (
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
              ) : (
                <TableRow>
                  <TableCell colSpan={5}>
                    <TableEmptyState
                      icon={Users}
                      title="No customers found"
                      description={
                        phoneInput || nameInput || quickFilter !== "all"
                          ? "Try adjusting your search or filters."
                          : "Customers will appear here once they register."
                      }
                    />
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

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
    </div>
  );
}
