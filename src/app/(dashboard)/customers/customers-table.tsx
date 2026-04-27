"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";

import type { PaginatedCustomersDto } from "@/lib/api/types";
import { Button } from "@/components/ui/button";
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
  const limit = 20;

  const { data, isFetching } = useQuery({
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

  const rows = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  function applyFilters() {
    setPhone(phoneInput);
    setName(nameInput);
    setPage(1);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
        <div className="grid gap-2">
          <Label htmlFor="f-phone">Phone contains</Label>
          <Input
            id="f-phone"
            value={phoneInput}
            onChange={(e) => setPhoneInput(e.target.value)}
            placeholder="Filter…"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="f-name">Name contains</Label>
          <Input
            id="f-name"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            placeholder="Filter…"
          />
        </div>
        <Button type="button" variant="secondary" onClick={applyFilters}>
          Apply filters
        </Button>
      </div>

      <div className="overflow-x-auto rounded-xl border bg-card">
        <Table className="min-w-[920px]" aria-busy={isFetching}>
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
                  No customers.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-mono text-sm">{c.phone}</TableCell>
                  <TableCell>{c.name}</TableCell>
                  <TableCell>{c.orderCount ?? 0}</TableCell>
                  <TableCell>{c.addressCount ?? 0}</TableCell>
                  <TableCell className="whitespace-nowrap text-sm">
                    {format(new Date(c.createdAt), "MMM d, yyyy")}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-muted-foreground text-sm">
          Page {page} of {totalPages} · {total} total
        </p>
        <div className="flex gap-2 self-end sm:self-auto">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Previous
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
