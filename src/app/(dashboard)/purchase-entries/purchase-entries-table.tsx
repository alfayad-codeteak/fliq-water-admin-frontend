"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Eye, IndianRupee, Package, Plus, Receipt, Trash2 } from "lucide-react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";

import { createPurchaseEntryAction } from "@/lib/actions/purchase-entries";
import { clientFetch } from "@/lib/api/client-fetch";
import type { ProductDto, PurchaseEntryDto } from "@/lib/api/types";
import { Button } from "@/components/ui/button";
import { TableEmptyState } from "@/components/ui/data-table/table-empty-state";
import { TableFilterChips } from "@/components/ui/data-table/table-filter-chips";
import { TablePagination } from "@/components/ui/data-table/table-pagination";
import { TableSearchInput } from "@/components/ui/data-table/table-search-input";
import { TableSkeletonRows } from "@/components/ui/data-table/table-skeleton-rows";
import { TableStatCards } from "@/components/ui/data-table/table-stat-cards";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

type LineItem = { productId: string; quantity: string; unitCost: string };

function formatMoney(v: unknown): string {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return "—";
  return `₹${n.toFixed(2)}`;
}

function firstRootError(
  error:
    | { root?: string[] }
    | Record<string, string[]>
    | undefined
): string | null {
  if (!error) return null;
  if ("root" in error && Array.isArray(error.root) && error.root[0]) {
    return error.root[0];
  }
  return null;
}

function toIsoFromDatetimeLocal(v: string): string | undefined {
  const trimmed = v.trim();
  if (!trimmed) return undefined;
  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString();
}

type DatePreset = "all" | "this-month" | "last-30";

export function PurchaseEntriesTable({
  initialData,
}: {
  initialData: PurchaseEntryDto[];
}) {
  const queryClient = useQueryClient();
  const { status } = useSession();

  const [dateFromInput, setDateFromInput] = React.useState("");
  const [dateToInput, setDateToInput] = React.useState("");
  const [supplierInput, setSupplierInput] = React.useState("");
  const [referenceInput, setReferenceInput] = React.useState("");
  const [dateFrom, setDateFrom] = React.useState("");
  const [dateTo, setDateTo] = React.useState("");
  const [supplierName, setSupplierName] = React.useState("");
  const [referenceNo, setReferenceNo] = React.useState("");

  const [datePreset, setDatePreset] = React.useState<DatePreset>("all");
  const [search, setSearch] = React.useState("");
  const [pageIndex, setPageIndex] = React.useState(0);
  const [pageSize, setPageSize] = React.useState(10);

  const [createOpen, setCreateOpen] = React.useState(false);
  const [viewRow, setViewRow] = React.useState<PurchaseEntryDto | null>(null);

  const { data: rows = initialData, isFetching } = useQuery({
    queryKey: [
      "admin-purchase-entries",
      dateFrom,
      dateTo,
      supplierName,
      referenceNo,
    ],
    queryFn: async () => {
      const q = new URLSearchParams();
      if (dateFrom) q.set("dateFrom", dateFrom);
      if (dateTo) q.set("dateTo", dateTo);
      if (supplierName.trim()) q.set("supplierName", supplierName.trim());
      if (referenceNo.trim()) q.set("referenceNo", referenceNo.trim());
      const suffix = q.toString() ? `?${q.toString()}` : "";
      const res = await clientFetch(
        `/api/bff/admin/purchase-entries${suffix}`
      );
      if (!res.ok) throw new Error("Failed to load purchase entries");
      return res.json() as Promise<PurchaseEntryDto[]>;
    },
    initialData,
    enabled: status === "authenticated",
  });

  const { data: products = [] } = useQuery({
    queryKey: ["admin-products"],
    queryFn: async () => {
      const res = await clientFetch("/api/bff/admin/products");
      if (!res.ok) throw new Error("Failed to load products");
      return res.json() as Promise<ProductDto[]>;
    },
    enabled: status === "authenticated" && createOpen,
    staleTime: 60_000,
  });

  function applyFilters() {
    setDateFrom(dateFromInput);
    setDateTo(dateToInput);
    setSupplierName(supplierInput);
    setReferenceNo(referenceInput);
    setPageIndex(0);
  }

  function applyPreset(preset: DatePreset) {
    setDatePreset(preset);
    const now = new Date();
    if (preset === "all") {
      setDateFromInput("");
      setDateToInput("");
      setDateFrom("");
      setDateTo("");
    } else if (preset === "this-month") {
      const from = new Date(now.getFullYear(), now.getMonth(), 1)
        .toISOString()
        .slice(0, 10);
      const to = now.toISOString().slice(0, 10);
      setDateFromInput(from);
      setDateToInput(to);
      setDateFrom(from);
      setDateTo(to);
    } else {
      const from = new Date(now.getTime() - 30 * 86400000)
        .toISOString()
        .slice(0, 10);
      const to = now.toISOString().slice(0, 10);
      setDateFromInput(from);
      setDateToInput(to);
      setDateFrom(from);
      setDateTo(to);
    }
    setPageIndex(0);
  }

  const stats = React.useMemo(() => {
    const totalSpend = rows.reduce((s, r) => {
      const n = typeof r.totalAmount === "number" ? r.totalAmount : Number(r.totalAmount);
      return s + (Number.isFinite(n) ? n : 0);
    }, 0);
    const totalLines = rows.reduce((s, r) => s + (r.items?.length ?? 0), 0);
    return { count: rows.length, totalSpend, totalLines };
  }, [rows]);

  const filtered = React.useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return rows;
    return rows.filter((r) => {
      const hay = [r.supplierName, r.referenceNo, r.createdBy?.name, r.createdBy?.phone]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [rows, search]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice(
    pageIndex * pageSize,
    pageIndex * pageSize + pageSize
  );

  React.useEffect(() => {
    setPageIndex(0);
  }, [search, pageSize, rows.length]);

  const presetChips = [
    { id: "all", label: "All time" },
    { id: "this-month", label: "This month" },
    { id: "last-30", label: "Last 30 days" },
  ];

  return (
    <div className="space-y-5">
      <TableStatCards
        items={[
          { label: "Entries", value: stats.count, icon: Receipt },
          {
            label: "Total spend",
            value: formatMoney(stats.totalSpend),
            icon: IndianRupee,
          },
          { label: "Line items", value: stats.totalLines, icon: Package },
          { label: "Showing", value: filtered.length, icon: Receipt },
        ]}
      />

      <div className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <TableSearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search supplier, reference, or entered by…"
            aria-label="Search purchase entries"
          />
          <div className="grid gap-1.5">
            <Label htmlFor="pe-from" className="text-xs">
              From
            </Label>
            <Input
              id="pe-from"
              type="date"
              value={dateFromInput}
              onChange={(e) => setDateFromInput(e.target.value)}
              className="h-9"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="pe-to" className="text-xs">
              To
            </Label>
            <Input
              id="pe-to"
              type="date"
              value={dateToInput}
              onChange={(e) => setDateToInput(e.target.value)}
              className="h-9"
            />
          </div>
          <div className="grid min-w-[10rem] gap-1.5">
            <Label htmlFor="pe-supplier" className="text-xs">
              Supplier
            </Label>
            <Input
              id="pe-supplier"
              value={supplierInput}
              onChange={(e) => setSupplierInput(e.target.value)}
              placeholder="Partial match…"
              className="h-9"
            />
          </div>
          <div className="grid min-w-[10rem] gap-1.5">
            <Label htmlFor="pe-ref" className="text-xs">
              Reference
            </Label>
            <Input
              id="pe-ref"
              value={referenceInput}
              onChange={(e) => setReferenceInput(e.target.value)}
              placeholder="INV-…"
              className="h-9"
            />
          </div>
          <Button type="button" variant="secondary" onClick={applyFilters}>
            Apply
          </Button>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <TableFilterChips
            chips={presetChips}
            activeId={datePreset}
            onChange={(id) => applyPreset(id as DatePreset)}
          />
          <Button type="button" size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 size-4" />
            New purchase entry
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        <div className="overflow-x-auto">
          <Table className="min-w-[960px]" aria-busy={isFetching}>
            <TableHeader className="bg-muted/40 sticky top-0 z-10 backdrop-blur-sm">
              <TableRow className="hover:bg-transparent">
                <TableHead className="h-11 text-xs">Purchased</TableHead>
                <TableHead className="h-11 text-xs">Supplier</TableHead>
                <TableHead className="h-11 text-xs">Reference</TableHead>
                <TableHead className="h-11 text-center text-xs">Lines</TableHead>
                <TableHead className="h-11 text-right text-xs">Total</TableHead>
                <TableHead className="h-11 text-xs">Entered by</TableHead>
                <TableHead className="h-11 text-right text-xs">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isFetching && rows.length === 0 ? (
                <TableSkeletonRows colSpan={7} />
              ) : paged.length ? (
                paged.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="whitespace-nowrap text-sm">
                    {format(new Date(row.purchasedAt), "MMM d, yyyy HH:mm")}
                  </TableCell>
                  <TableCell>{row.supplierName?.trim() || "—"}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {row.referenceNo?.trim() || "—"}
                  </TableCell>
                  <TableCell className="text-center tabular-nums">
                    {row.items?.length ?? 0}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    {formatMoney(row.totalAmount)}
                  </TableCell>
                  <TableCell className="text-sm">
                    {row.createdBy?.name ?? row.createdBy?.phone ?? "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="View entry"
                      onClick={() => setViewRow(row)}
                    >
                      <Eye className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7}>
                    <TableEmptyState
                      icon={Receipt}
                      title="No purchase entries found"
                      description={
                        search ||
                        dateFrom ||
                        dateTo ||
                        supplierName ||
                        referenceNo
                          ? "Try adjusting your search or filters."
                          : "Record your first stock-in from a supplier."
                      }
                      action={
                        !search &&
                        !dateFrom &&
                        !dateTo &&
                        !supplierName &&
                        !referenceNo
                          ? {
                              label: "New purchase entry",
                              onClick: () => setCreateOpen(true),
                            }
                          : undefined
                      }
                    />
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <TablePagination
          pageIndex={pageIndex}
          pageCount={pageCount}
          pageSize={pageSize}
          totalItems={filtered.length}
          itemLabel="entry"
          isFetching={isFetching}
          onPageSizeChange={setPageSize}
          onPrevious={() => setPageIndex((p) => Math.max(0, p - 1))}
          onNext={() => setPageIndex((p) => p + 1)}
          canPrevious={pageIndex > 0}
          canNext={pageIndex < pageCount - 1}
        />
      </div>

      <CreatePurchaseEntryDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        products={products}
        onCreated={() => {
          queryClient.invalidateQueries({
            queryKey: ["admin-purchase-entries"],
          });
          queryClient.invalidateQueries({ queryKey: ["admin-products"] });
        }}
      />

      <Dialog open={!!viewRow} onOpenChange={(o) => !o && setViewRow(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Purchase entry</DialogTitle>
            <DialogDescription>
              {viewRow?.referenceNo
                ? `Ref ${viewRow.referenceNo}`
                : "Stock-in details"}
            </DialogDescription>
          </DialogHeader>
          {viewRow ? (
            <div className="space-y-4 text-sm">
              <dl className="grid gap-2 sm:grid-cols-2">
                <div>
                  <dt className="text-muted-foreground text-xs">Supplier</dt>
                  <dd>{viewRow.supplierName ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground text-xs">Purchased</dt>
                  <dd>
                    {format(new Date(viewRow.purchasedAt), "PPpp")}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground text-xs">Total</dt>
                  <dd className="font-mono">{formatMoney(viewRow.totalAmount)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground text-xs">Entered by</dt>
                  <dd>
                    {viewRow.createdBy?.name ?? viewRow.createdBy?.phone ?? "—"}
                  </dd>
                </div>
              </dl>
              {viewRow.notes ? (
                <p className="text-muted-foreground rounded-md border p-3 text-xs">
                  {viewRow.notes}
                </p>
              ) : null}
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Unit cost</TableHead>
                      <TableHead className="text-right">Line</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(viewRow.items ?? []).map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>{item.productName ?? item.productId}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {item.quantity}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {formatMoney(item.unitCost)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {formatMoney(
                            item.lineTotal ?? item.unitCost * item.quantity
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CreatePurchaseEntryDialog({
  open,
  onOpenChange,
  products,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: ProductDto[];
  onCreated: () => void;
}) {
  const [saving, setSaving] = React.useState(false);
  const [supplierName, setSupplierName] = React.useState("");
  const [referenceNo, setReferenceNo] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [purchasedAt, setPurchasedAt] = React.useState("");
  const [items, setItems] = React.useState<LineItem[]>([
    { productId: "", quantity: "1", unitCost: "" },
  ]);

  React.useEffect(() => {
    if (!open) {
      setSupplierName("");
      setReferenceNo("");
      setNotes("");
      setPurchasedAt("");
      setItems([{ productId: "", quantity: "1", unitCost: "" }]);
    } else {
      const now = new Date();
      now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
      setPurchasedAt(now.toISOString().slice(0, 16));
    }
  }, [open]);

  function updateItem(index: number, patch: Partial<LineItem>) {
    setItems((prev) =>
      prev.map((row, i) => (i === index ? { ...row, ...patch } : row))
    );
  }

  async function submit() {
    const payload = {
      supplierName: supplierName.trim() || undefined,
      referenceNo: referenceNo.trim() || undefined,
      notes: notes.trim() || undefined,
      purchasedAt: toIsoFromDatetimeLocal(purchasedAt),
      items: items
        .filter((i) => i.productId && Number(i.quantity) > 0)
        .map((i) => ({
          productId: i.productId,
          quantity: Number.parseInt(i.quantity, 10),
          unitCost: Number.parseFloat(i.unitCost),
        })),
    };

    if (payload.items.length === 0) {
      toast.error("Add at least one product line");
      return;
    }
    if (payload.items.some((i) => !Number.isFinite(i.unitCost) || i.unitCost < 0)) {
      toast.error("Enter valid unit costs");
      return;
    }

    setSaving(true);
    const res = await createPurchaseEntryAction(payload);
    setSaving(false);
    if (!res.ok) {
      toast.error(firstRootError(res.error) ?? "Create failed");
      return;
    }
    toast.success("Purchase entry recorded — stock updated");
    onOpenChange(false);
    onCreated();
  }

  const previewTotal = items.reduce((sum, row) => {
    const q = Number.parseInt(row.quantity, 10);
    const c = Number.parseFloat(row.unitCost);
    if (!Number.isFinite(q) || !Number.isFinite(c) || q <= 0) return sum;
    return sum + q * c;
  }, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New purchase entry</DialogTitle>
          <DialogDescription>
            Record stock received from a supplier. Product inventory increases
            automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="pe-new-supplier">Supplier name</Label>
            <Input
              id="pe-new-supplier"
              value={supplierName}
              onChange={(e) => setSupplierName(e.target.value)}
              placeholder="Aqua Supplies Pvt Ltd"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="pe-new-ref">Reference / invoice no.</Label>
              <Input
                id="pe-new-ref"
                value={referenceNo}
                onChange={(e) => setReferenceNo(e.target.value)}
                placeholder="INV-2026-0042"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="pe-new-date">Purchased at</Label>
              <Input
                id="pe-new-date"
                type="datetime-local"
                value={purchasedAt}
                onChange={(e) => setPurchasedAt(e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="pe-new-notes">Notes</Label>
            <Input
              id="pe-new-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label>Line items</Label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  setItems((prev) => [
                    ...prev,
                    { productId: "", quantity: "1", unitCost: "" },
                  ])
                }
              >
                <Plus className="mr-1 size-4" />
                Add line
              </Button>
            </div>
            <ul className="space-y-2">
              {items.map((row, idx) => (
                <li
                  key={`pe-line-${idx}`}
                  className="grid gap-2 rounded-md border p-3 sm:grid-cols-[1fr_5rem_5rem_auto]"
                >
                  <select
                    className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
                    value={row.productId}
                    onChange={(e) =>
                      updateItem(idx, { productId: e.target.value })
                    }
                  >
                    <option value="">Select product…</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} (stock {p.stock})
                      </option>
                    ))}
                  </select>
                  <Input
                    type="number"
                    min={1}
                    step={1}
                    placeholder="Qty"
                    value={row.quantity}
                    onChange={(e) =>
                      updateItem(idx, { quantity: e.target.value })
                    }
                  />
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="Cost"
                    value={row.unitCost}
                    onChange={(e) =>
                      updateItem(idx, { unitCost: e.target.value })
                    }
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    disabled={items.length <= 1}
                    aria-label="Remove line"
                    onClick={() =>
                      setItems((prev) => prev.filter((_, i) => i !== idx))
                    }
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </li>
              ))}
            </ul>
            <p className="text-muted-foreground text-right text-xs font-mono">
              Preview total: {formatMoney(previewTotal)}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" disabled={saving} onClick={() => submit()}>
            {saving ? "Saving…" : "Record purchase"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
