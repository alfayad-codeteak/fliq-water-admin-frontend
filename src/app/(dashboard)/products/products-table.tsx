"use client";

import * as React from "react";
import Image from "next/image";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";
import { format } from "date-fns";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Braces,
  ChevronLeft,
  ChevronRight,
  Columns3,
  ImageOff,
  LayoutList,
  MoreHorizontal,
  Package,
  PackageX,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";

import {
  bulkUpdateProductsAction,
  createProductAction,
  deleteProductAction,
  toggleProductActiveAction,
  updateProductAction,
} from "@/lib/actions/products";
import { clientFetch } from "@/lib/api/client-fetch";
import type { DepositConfigDto, ProductDto } from "@/lib/api/types";
import {
  safeParseBulkProductItem,
  type ParsedBulkProduct,
} from "@/lib/products/bulk-product-json";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const LOW_STOCK_THRESHOLD = 10;

const COLUMN_LABELS: Record<string, string> = {
  product: "Product",
  price: "Price",
  stock: "Stock",
  deposit: "Deposit",
  isActive: "Visible",
  updatedAt: "Updated",
};

type StatusFilter = "all" | "active" | "hidden" | "low" | "out";

function formatInr(value: number): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value);
}

function getStockMeta(stock: number) {
  if (stock <= 0) {
    return { label: "Out of stock", tone: "destructive" as const };
  }
  if (stock <= LOW_STOCK_THRESHOLD) {
    return { label: "Low stock", tone: "warning" as const };
  }
  return { label: "In stock", tone: "success" as const };
}

function SortHeader({
  label,
  sorted,
  onToggle,
}: {
  label: string;
  sorted: false | "asc" | "desc";
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      className="hover:text-foreground -ml-1 inline-flex items-center gap-1.5 rounded px-1 py-0.5 font-medium transition-colors"
      onClick={onToggle}
    >
      {label}
      {sorted === "asc" ? (
        <ArrowUp className="size-3.5" />
      ) : sorted === "desc" ? (
        <ArrowDown className="size-3.5" />
      ) : (
        <ArrowUpDown className="size-3.5 opacity-40" />
      )}
    </button>
  );
}

function ProductThumb({
  urls,
  fallbackUrl,
  name,
}: {
  urls?: string[] | null;
  fallbackUrl?: string | null;
  name: string;
}) {
  const imageList = React.useMemo(() => {
    const list = (urls ?? [])
      .map((item) => item?.trim())
      .filter((item): item is string => Boolean(item));
    if (list.length) return list;
    const fallback = fallbackUrl?.trim();
    return fallback ? [fallback] : [];
  }, [urls, fallbackUrl]);
  const imageListSignature = React.useMemo(() => imageList.join("|"), [imageList]);

  const [index, setIndex] = React.useState(0);
  const [broken, setBroken] = React.useState(false);

  React.useEffect(() => {
    setIndex(0);
    setBroken(false);
  }, [imageListSignature]);

  React.useEffect(() => {
    if (imageList.length <= 1) return;
    const timer = window.setInterval(() => {
      setBroken(false);
      setIndex((prev) => (prev + 1) % imageList.length);
    }, 2000);
    return () => window.clearInterval(timer);
  }, [imageList]);

  const trimmed = imageList[index];
  if (!trimmed || broken) {
    return (
      <div
        className="bg-muted text-muted-foreground flex size-11 shrink-0 items-center justify-center rounded-md border"
        title={!trimmed ? "No image" : "Image failed to load"}
      >
        <ImageOff className="size-4" aria-hidden />
      </div>
    );
  }
  return (
    <Image
      src={trimmed}
      alt={name}
      width={44}
      height={44}
      unoptimized
      className="size-11 shrink-0 rounded-md border object-cover"
      onError={() => setBroken(true)}
    />
  );
}

export function ProductsTable({
  initialData,
  depositConfig,
}: {
  initialData: ProductDto[];
  depositConfig: DepositConfigDto | null;
}) {
  const queryClient = useQueryClient();
  const { status } = useSession();
  const { data: rows = initialData, isFetching, isLoading } = useQuery({
    queryKey: ["admin-products"],
    queryFn: async () => {
      const res = await clientFetch("/api/bff/admin/products");
      if (!res.ok) throw new Error("Failed to load products");
      return res.json() as Promise<ProductDto[]>;
    },
    initialData,
    enabled: status === "authenticated",
  });

  const [sorting, setSorting] = React.useState<SortingState>([
    { id: "product", desc: false },
  ]);
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({});
  const [globalFilter, setGlobalFilter] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("all");
  const [categoryFilter, setCategoryFilter] = React.useState("all");
  const [pageSize, setPageSize] = React.useState(10);
  const [bulkSaving, setBulkSaving] = React.useState(false);
  const [togglingId, setTogglingId] = React.useState<string | null>(null);
  const [bulkDrafts, setBulkDrafts] = React.useState<
    Record<string, { price: string; stock: string }>
  >({});

  const [createOpen, setCreateOpen] = React.useState(false);
  const [createDupSideOpen, setCreateDupSideOpen] = React.useState(false);
  const [editRow, setEditRow] = React.useState<ProductDto | null>(null);
  const [deleteRow, setDeleteRow] = React.useState<ProductDto | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  const categories = React.useMemo(() => {
    const set = new Set<string>();
    for (const row of rows) {
      const c = row.category?.trim();
      if (c) set.add(c);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const stats = React.useMemo(() => {
    const active = rows.filter((r) => r.isActive !== false).length;
    const low = rows.filter(
      (r) => r.stock > 0 && r.stock <= LOW_STOCK_THRESHOLD
    ).length;
    const out = rows.filter((r) => r.stock <= 0).length;
    return { total: rows.length, active, low, out };
  }, [rows]);

  const filteredRows = React.useMemo(() => {
    return rows.filter((row) => {
      if (statusFilter === "active" && row.isActive === false) return false;
      if (statusFilter === "hidden" && row.isActive !== false) return false;
      if (statusFilter === "low" && !(row.stock > 0 && row.stock <= LOW_STOCK_THRESHOLD))
        return false;
      if (statusFilter === "out" && row.stock > 0) return false;
      if (categoryFilter !== "all" && row.category !== categoryFilter) return false;
      return true;
    });
  }, [rows, statusFilter, categoryFilter]);

  const onBulkFieldChange = React.useCallback(
    (product: ProductDto, field: "price" | "stock", value: string) => {
      setBulkDrafts((prev) => {
        const existing = prev[product.id] ?? {
          price: String(product.price),
          stock: String(product.stock),
        };
        return {
          ...prev,
          [product.id]: { ...existing, [field]: value },
        };
      });
    },
    []
  );

  const changedItems = React.useMemo(() => {
    const byId = new Map(rows.map((row) => [row.id, row]));
    const items: Array<{ id: string; price: number; stock: number }> = [];

    for (const [id, draft] of Object.entries(bulkDrafts)) {
      const original = byId.get(id);
      if (!original) continue;
      const price = Number(draft.price);
      const stock = Number(draft.stock);
      const isPriceValid = Number.isFinite(price) && price >= 0;
      const isStockValid = Number.isInteger(stock) && stock >= 0;
      if (!isPriceValid || !isStockValid) continue;
      if (price !== original.price || stock !== original.stock) {
        items.push({ id, price, stock });
      }
    }
    return items;
  }, [bulkDrafts, rows]);

  const hasInvalidDrafts = React.useMemo(() => {
    return Object.entries(bulkDrafts).some(([, draft]) => {
      const price = Number(draft.price);
      const stock = Number(draft.stock);
      return !(
        Number.isFinite(price) &&
        price >= 0 &&
        Number.isInteger(stock) &&
        stock >= 0
      );
    });
  }, [bulkDrafts]);

  const handleBulkSave = React.useCallback(async () => {
    if (hasInvalidDrafts) {
      toast.error("Fix invalid price/stock values before saving");
      return;
    }
    if (changedItems.length === 0) {
      toast.message("No bulk changes to save");
      return;
    }

    setBulkSaving(true);
    const result = await bulkUpdateProductsAction({ items: changedItems });
    setBulkSaving(false);

    if (!result.ok) {
      const root = "root" in result.error ? result.error.root?.[0] : undefined;
      toast.error(root ?? "Bulk update failed");
      return;
    }

    toast.success(`Updated ${result.data.count} products`);
    setBulkDrafts({});
    queryClient.invalidateQueries({ queryKey: ["admin-products"] });
  }, [changedItems, hasInvalidDrafts, queryClient]);

  const handleToggleActive = React.useCallback(
    async (product: ProductDto, next: boolean) => {
      setTogglingId(product.id);
      const res = await toggleProductActiveAction(product.id, next);
      setTogglingId(null);
      if (!res.ok) {
        toast.error(res.error ?? "Could not update status");
        return;
      }
      toast.success(next ? "Product is now visible" : "Product hidden from catalog");
      queryClient.invalidateQueries({ queryKey: ["admin-products"] });
    },
    [queryClient]
  );

  const columns = React.useMemo<ColumnDef<ProductDto>[]>(
    () => [
      {
        id: "product",
        accessorKey: "name",
        enableHiding: false,
        header: ({ column }) => (
          <SortHeader
            label="Product"
            sorted={column.getIsSorted()}
            onToggle={() =>
              column.toggleSorting(column.getIsSorted() === "asc")
            }
          />
        ),
        cell: ({ row }) => (
          <div className="flex min-w-[220px] items-center gap-3">
            <ProductThumb
              urls={row.original.photoUrls}
              fallbackUrl={row.original.photoUrl}
              name={row.original.name}
            />
            <div className="min-w-0">
              <p className="truncate font-medium">{row.original.name}</p>
              <p className="text-muted-foreground truncate text-xs">
                {row.original.category?.trim() || "Uncategorized"}
              </p>
            </div>
          </div>
        ),
      },
      {
        accessorKey: "price",
        header: ({ column }) => (
          <SortHeader
            label="Price"
            sorted={column.getIsSorted()}
            onToggle={() =>
              column.toggleSorting(column.getIsSorted() === "asc")
            }
          />
        ),
        cell: ({ row }) => {
          const draft = bulkDrafts[row.original.id];
          const current = draft?.price ?? String(row.original.price);
          const changed =
            draft?.price !== undefined &&
            Number(draft.price) !== row.original.price;
          return (
            <div className="space-y-1">
              <Input
                type="number"
                step="0.01"
                min={0}
                value={current}
                onChange={(e) =>
                  onBulkFieldChange(row.original, "price", e.target.value)
                }
                className={cn(
                  "h-8 w-28 tabular-nums",
                  changed &&
                    "border-amber-500/60 bg-amber-500/5 ring-1 ring-amber-500/20"
                )}
                aria-label={`Price for ${row.original.name}`}
              />
              {!changed ? (
                <p className="text-muted-foreground text-[11px] tabular-nums">
                  {formatInr(row.original.price)}
                </p>
              ) : null}
            </div>
          );
        },
      },
      {
        accessorKey: "stock",
        header: ({ column }) => (
          <SortHeader
            label="Stock"
            sorted={column.getIsSorted()}
            onToggle={() =>
              column.toggleSorting(column.getIsSorted() === "asc")
            }
          />
        ),
        cell: ({ row }) => {
          const draft = bulkDrafts[row.original.id];
          const current = draft?.stock ?? String(row.original.stock);
          const stockNum = Number(current);
          const meta = getStockMeta(Number.isFinite(stockNum) ? stockNum : 0);
          const changed =
            draft?.stock !== undefined &&
            Number(draft.stock) !== row.original.stock;
          return (
            <div className="space-y-1.5">
              <Input
                type="number"
                min={0}
                step="1"
                value={current}
                onChange={(e) =>
                  onBulkFieldChange(row.original, "stock", e.target.value)
                }
                className={cn(
                  "h-8 w-20 tabular-nums",
                  changed &&
                    "border-amber-500/60 bg-amber-500/5 ring-1 ring-amber-500/20"
                )}
                aria-label={`Stock for ${row.original.name}`}
              />
              <Badge
                variant="outline"
                className={cn(
                  "h-5 px-1.5 text-[10px] font-normal",
                  meta.tone === "destructive" &&
                    "border-red-500/30 bg-red-500/10 text-red-600",
                  meta.tone === "warning" &&
                    "border-amber-500/30 bg-amber-500/10 text-amber-700",
                  meta.tone === "success" &&
                    "border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
                )}
              >
                {meta.label}
              </Badge>
            </div>
          );
        },
      },
      {
        id: "deposit",
        accessorFn: (row) => (row.hasDeposit !== false ? 1 : 0),
        header: ({ column }) => (
          <SortHeader
            label="Deposit"
            sorted={column.getIsSorted()}
            onToggle={() =>
              column.toggleSorting(column.getIsSorted() === "asc")
            }
          />
        ),
        cell: ({ row }) => {
          const applies = row.original.hasDeposit !== false;
          const perCan = depositConfig?.perCanAmount ?? 0;
          const depositsEnabled = depositConfig?.enabled !== false;
          return (
            <div className="space-y-1">
              <Badge variant={applies ? "default" : "outline"} className="h-5">
                {applies ? "True" : "False"}
              </Badge>
              {applies ? (
                <p className="text-muted-foreground text-xs tabular-nums">
                  {depositsEnabled && perCan > 0
                    ? `${formatInr(perCan)} / can`
                    : "—"}
                </p>
              ) : (
                <p className="text-muted-foreground text-xs">—</p>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: "isActive",
        header: "Visible",
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <Switch
              checked={row.original.isActive !== false}
              disabled={togglingId === row.original.id}
              onCheckedChange={(v) => void handleToggleActive(row.original, v)}
              aria-label={`Toggle visibility for ${row.original.name}`}
            />
            <span className="text-muted-foreground hidden text-xs sm:inline">
              {row.original.isActive !== false ? "Active" : "Hidden"}
            </span>
          </div>
        ),
      },
      {
        accessorKey: "updatedAt",
        header: ({ column }) => (
          <SortHeader
            label="Updated"
            sorted={column.getIsSorted()}
            onToggle={() =>
              column.toggleSorting(column.getIsSorted() === "asc")
            }
          />
        ),
        cell: ({ row }) => (
          <span className="text-muted-foreground whitespace-nowrap text-sm">
            {row.original.updatedAt
              ? format(new Date(row.original.updatedAt), "MMM d, yyyy")
              : "—"}
          </span>
        ),
      },
      {
        id: "actions",
        enableHiding: false,
        header: "",
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger
              className="hover:bg-muted inline-flex size-8 items-center justify-center rounded-md outline-none"
              aria-label={`Actions for ${row.original.name}`}
            >
              <MoreHorizontal className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem onClick={() => setEditRow(row.original)}>
                <Pencil className="mr-2 size-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={() => setDeleteRow(row.original)}
              >
                <Trash2 className="mr-2 size-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [bulkDrafts, depositConfig, handleToggleActive, onBulkFieldChange, togglingId]
  );

  const table = useReactTable({
    data: filteredRows,
    columns,
    state: { sorting, globalFilter, columnVisibility },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    globalFilterFn: (row, _columnId, filterValue) => {
      const q = String(filterValue).toLowerCase().trim();
      if (!q) return true;
      const name = row.original.name.toLowerCase();
      const category = (row.original.category ?? "").toLowerCase();
      return name.includes(q) || category.includes(q);
    },
  });

  React.useEffect(() => {
    table.setPageSize(pageSize);
  }, [pageSize, table]);

  const filterChips: { id: StatusFilter; label: string; count?: number }[] = [
    { id: "all", label: "All", count: stats.total },
    { id: "active", label: "Active", count: stats.active },
    { id: "hidden", label: "Hidden", count: stats.total - stats.active },
    { id: "low", label: "Low stock", count: stats.low },
    { id: "out", label: "Out of stock", count: stats.out },
  ];

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Total products", value: stats.total, icon: Package },
          { label: "Active", value: stats.active, icon: Package },
          { label: "Low stock", value: stats.low, icon: AlertTriangle },
          { label: "Out of stock", value: stats.out, icon: PackageX },
        ].map((item) => (
          <div
            key={item.label}
            className="bg-card flex items-center justify-between rounded-xl border px-4 py-3 shadow-sm"
          >
            <div>
              <p className="text-muted-foreground text-xs">{item.label}</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">
                {item.value}
              </p>
            </div>
            <div className="bg-muted text-muted-foreground flex size-9 items-center justify-center rounded-lg">
              <item.icon className="size-4" />
            </div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative max-w-md flex-1">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              placeholder="Search products or categories…"
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className="h-9 pl-9"
              aria-label="Search products"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {changedItems.length > 0 ? (
              <Badge variant="secondary" className="h-7 px-2.5">
                {changedItems.length} unsaved
              </Badge>
            ) : null}
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setBulkDrafts({})}
              disabled={bulkSaving || Object.keys(bulkDrafts).length === 0}
            >
              Discard
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => void handleBulkSave()}
              disabled={bulkSaving || changedItems.length === 0}
            >
              {bulkSaving ? "Saving…" : `Save changes (${changedItems.length})`}
            </Button>
            <Button type="button" size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 size-4" />
              Add product
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-1.5">
            {filterChips.map((chip) => (
              <button
                key={chip.id}
                type="button"
                onClick={() => setStatusFilter(chip.id)}
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors",
                  statusFilter === chip.id
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background hover:bg-muted text-muted-foreground"
                )}
              >
                {chip.label}
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-[10px] tabular-nums",
                    statusFilter === chip.id
                      ? "bg-primary-foreground/15"
                      : "bg-muted"
                  )}
                >
                  {chip.count}
                </span>
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {categories.length > 0 ? (
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="border-input bg-background h-8 rounded-md border px-2.5 text-xs shadow-xs outline-none"
                aria-label="Filter by category"
              >
                <option value="all">All categories</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            ) : null}
            <DropdownMenu>
              <DropdownMenuTrigger
                className="border-input bg-background hover:bg-muted inline-flex h-8 items-center rounded-md border px-2.5 text-xs font-medium shadow-xs outline-none"
                aria-label="Toggle table columns"
              >
                <Columns3 className="mr-1.5 size-3.5" />
                Columns
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuLabel>Show columns</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {table
                  .getAllColumns()
                  .filter((col) => col.getCanHide())
                  .map((col) => (
                    <DropdownMenuCheckboxItem
                      key={col.id}
                      checked={col.getIsVisible()}
                      onCheckedChange={(value) => col.toggleVisibility(!!value)}
                    >
                      {COLUMN_LABELS[col.id] ?? col.id}
                    </DropdownMenuCheckboxItem>
                  ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="space-y-3">
        <div className="overflow-x-auto">
          <Table className="min-w-[960px]" aria-busy={isFetching}>
            <TableHeader className="bg-muted/40 sticky top-0 z-10 backdrop-blur-sm">
              {table.getHeaderGroups().map((hg) => (
                <TableRow key={hg.id} className="hover:bg-transparent">
                  {hg.headers.map((h) => (
                    <TableHead key={h.id} className="h-11 text-xs">
                      {h.isPlaceholder
                        ? null
                        : flexRender(
                            h.column.columnDef.header,
                            h.getContext()
                          )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {isLoading && rows.length === 0 ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={`sk-${i}`}>
                    <TableCell colSpan={columns.length}>
                      <div className="flex items-center gap-3 py-1">
                        <Skeleton className="size-11 rounded-md" />
                        <div className="space-y-2">
                          <Skeleton className="h-4 w-40" />
                          <Skeleton className="h-3 w-24" />
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : table.getRowModel().rows.length ? (
                table.getRowModel().rows.map((row) => {
                  const hasDraft = Boolean(bulkDrafts[row.original.id]);
                  return (
                    <TableRow
                      key={row.id}
                      className={cn(
                        "group transition-colors",
                        hasDraft && "bg-amber-500/[0.03]"
                      )}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id} className="py-3">
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext()
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-40">
                    <div className="flex flex-col items-center justify-center gap-2 text-center">
                      <Package className="text-muted-foreground size-8 opacity-50" />
                      <p className="font-medium">No products found</p>
                      <p className="text-muted-foreground max-w-sm text-sm">
                        {globalFilter || statusFilter !== "all" || categoryFilter !== "all"
                          ? "Try adjusting your search or filters."
                          : "Add your first product to start building the catalog."}
                      </p>
                      {!globalFilter && statusFilter === "all" ? (
                        <Button
                          type="button"
                          size="sm"
                          className="mt-2"
                          onClick={() => setCreateOpen(true)}
                        >
                          <Plus className="mr-2 size-4" />
                          Add product
                        </Button>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Footer */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-muted-foreground flex flex-wrap items-center gap-3 text-sm">
            <span>
              {table.getFilteredRowModel().rows.length} product
              {table.getFilteredRowModel().rows.length === 1 ? "" : "s"}
            </span>
            {isFetching ? (
              <span className="text-xs">Refreshing…</span>
            ) : null}
            <label className="flex items-center gap-2 text-xs">
              Rows
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="border-input bg-background h-7 rounded-md border px-2"
              >
                {[8, 10, 20, 50].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-sm">
              Page {table.getState().pagination.pageIndex + 1} of{" "}
              {table.getPageCount() || 1}
            </span>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              aria-label="Previous page"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              aria-label="Next page"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      </div>

      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) setCreateDupSideOpen(false);
        }}
      >
        <DialogContent
          className={cn(
            "flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0",
            createDupSideOpen
              ? "h-[min(92vh,56rem)] max-h-[min(92vh,56rem)] w-[min(calc(100vw-1.25rem),72rem)] max-w-[min(calc(100vw-1.25rem),72rem)] sm:max-w-6xl lg:max-w-7xl"
              : "w-[calc(100%-2rem)] max-w-3xl"
          )}
        >
          <div
            className={cn(
              "border-border shrink-0 border-b px-5 py-4",
              createDupSideOpen && "bg-muted/25"
            )}
          >
            <DialogHeader className="gap-1 space-y-1 text-left sm:text-left">
              <DialogTitle className="text-base sm:text-lg">New product</DialogTitle>
              <DialogDescription>Add a new catalog item.</DialogDescription>
            </DialogHeader>
          </div>
          <div
            className={cn(
              "min-h-0 flex-1",
              createDupSideOpen ? "overflow-hidden" : "overflow-y-auto px-5 py-4"
            )}
          >
            <ProductForm
              existingCatalogProducts={rows}
              onBulkDupPanelOpenChange={setCreateDupSideOpen}
              onDone={() => {
                setCreateOpen(false);
                setCreateDupSideOpen(false);
                queryClient.invalidateQueries({ queryKey: ["admin-products"] });
              }}
              action={createProductAction}
            />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editRow} onOpenChange={(o) => !o && setEditRow(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit product</DialogTitle>
            <DialogDescription>Update this catalog item.</DialogDescription>
          </DialogHeader>
          {editRow ? (
            <ProductForm
              initial={editRow}
              onDone={() => {
                setEditRow(null);
                queryClient.invalidateQueries({ queryKey: ["admin-products"] });
              }}
              action={updateProductAction}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteRow} onOpenChange={(o) => !o && setDeleteRow(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete product?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove{" "}
              <strong>{deleteRow?.name ?? "this product"}</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleting}
              onClick={async () => {
                if (!deleteRow) return;
                setDeleting(true);
                const res = await deleteProductAction(deleteRow.id);
                setDeleting(false);
                if (!res.ok) {
                  toast.error(res.error ?? "Could not delete product");
                  return;
                }
                toast.success("Product deleted");
                setDeleteRow(null);
                queryClient.invalidateQueries({ queryKey: ["admin-products"] });
              }}
            >
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}


function primaryImageUrlForBulkPreview(data: ParsedBulkProduct): string | null {
  const fromList = data.photoUrls?.map((u) => u?.trim()).find(Boolean);
  return (fromList ?? data.photoUrl?.trim()) || null;
}

function normalizeProductName(name: string): string {
  return name.trim().toLowerCase();
}

function catalogByNormalizedName(
  products: ProductDto[]
): Map<string, ProductDto> {
  const m = new Map<string, ProductDto>();
  for (const p of products) {
    const k = normalizeProductName(p.name);
    if (!m.has(k)) m.set(k, p);
  }
  return m;
}

function primaryImageUrlForCatalogProduct(p: ProductDto): string | null {
  const fromList = p.photoUrls?.map((u) => u?.trim()).find(Boolean);
  return (fromList ?? p.photoUrl?.trim()) || null;
}

type BulkDuplicateRowDraft = {
  name: string;
  price: string;
  stock: string;
  category: string;
  hasDeposit: boolean;
  photoUrlsText: string;
};

function applyDuplicateDraftsToBulkJson(
  jsonStr: string,
  draftIndices: number[],
  drafts: Record<number, BulkDuplicateRowDraft>
): string {
  const arr = JSON.parse(jsonStr) as unknown[];
  for (const idx of draftIndices) {
    const d = drafts[idx];
    if (!d) continue;
    const base =
      arr[idx] && typeof arr[idx] === "object" && !Array.isArray(arr[idx])
        ? { ...(arr[idx] as Record<string, unknown>) }
        : {};
    const photoLines = d.photoUrlsText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    const next: Record<string, unknown> = {
      ...base,
      name: d.name.trim(),
      price: Number(d.price),
      stock: Number.parseInt(String(d.stock), 10),
      hasDeposit: d.hasDeposit,
    };
    if (d.category.trim()) next.category = d.category.trim();
    else delete next.category;
    if (photoLines.length) {
      next.photoUrls = photoLines;
      delete next.photoUrl;
    } else {
      delete next.photoUrls;
      delete next.photoUrl;
    }
    arr[idx] = next;
  }
  return JSON.stringify(arr, null, 2);
}

function BulkDuplicateNameSidePanel({
  onDismiss,
  conflicts,
  bulkProductsJson,
  onApply,
}: {
  onDismiss: () => void;
  conflicts: {
    index: number;
    existing: ProductDto;
    draft: ParsedBulkProduct;
  }[];
  bulkProductsJson: string;
  onApply: (nextJson: string) => void;
}) {
  const [drafts, setDrafts] = React.useState<
    Record<number, BulkDuplicateRowDraft>
  >({});
  const [removeIndices, setRemoveIndices] = React.useState<Set<number>>(
    () => new Set()
  );

  const initSig = conflicts
    .map((c) => `${c.index}:${normalizeProductName(c.draft.name)}`)
    .join("|");

  React.useEffect(() => {
    if (conflicts.length === 0) return;
    const next: Record<number, BulkDuplicateRowDraft> = {};
    for (const c of conflicts) {
      const urls =
        c.draft.photoUrls && c.draft.photoUrls.length > 0
          ? c.draft.photoUrls.filter(Boolean).join("\n")
          : (c.draft.photoUrl ?? "");
      next[c.index] = {
        name: c.draft.name,
        price: String(c.draft.price),
        stock: String(c.draft.stock),
        category: c.draft.category ?? "",
        hasDeposit: c.draft.hasDeposit !== false,
        photoUrlsText: urls,
      };
    }
    setDrafts(next);
    setRemoveIndices(new Set());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- init when sig changes; avoid resetting drafts on parent re-render
  }, [initSig]);

  const toggleRemove = (index: number, remove: boolean) => {
    setRemoveIndices((prev) => {
      const next = new Set(prev);
      if (remove) next.add(index);
      else next.delete(index);
      return next;
    });
  };

  const updateDraft = (
    index: number,
    patch: Partial<BulkDuplicateRowDraft>
  ) => {
    setDrafts((prev) => ({
      ...prev,
      [index]: { ...prev[index]!, ...patch },
    }));
  };

  function handleSave() {
    let arr: unknown[];
    try {
      arr = JSON.parse(bulkProductsJson) as unknown[];
    } catch {
      toast.error("Could not read bulk JSON.");
      return;
    }
    const toRemove = [...removeIndices];
    if (arr.length - toRemove.length < 1) {
      toast.error("Leave at least one product in the import.");
      return;
    }
    for (const c of conflicts) {
      if (removeIndices.has(c.index)) continue;
      const d = drafts[c.index];
      if (!d?.name.trim()) {
        toast.error(`Row ${c.index + 1}: enter a product name.`);
        return;
      }
      const price = Number(d.price);
      const stock = Number.parseInt(String(d.stock), 10);
      if (!Number.isFinite(price) || price < 0) {
        toast.error(`Row ${c.index + 1}: invalid price.`);
        return;
      }
      if (!Number.isInteger(stock) || stock < 0) {
        toast.error(`Row ${c.index + 1}: invalid stock (whole number ≥ 0).`);
        return;
      }
    }
    try {
      const editIndices = conflicts
        .filter((c) => !removeIndices.has(c.index))
        .map((c) => c.index);
      let nextStr = bulkProductsJson;
      if (editIndices.length > 0) {
        nextStr = applyDuplicateDraftsToBulkJson(
          bulkProductsJson,
          editIndices,
          drafts
        );
      }
      const nextArr = JSON.parse(nextStr) as unknown[];
      for (const idx of [...toRemove].sort((a, b) => b - a)) {
        if (idx >= 0 && idx < nextArr.length) nextArr.splice(idx, 1);
      }
      onApply(JSON.stringify(nextArr, null, 2));
    } catch {
      toast.error("Could not update JSON.");
    }
  }

  return (
    <aside
      className="border-border flex max-h-[min(46vh,24rem)] w-full shrink-0 flex-col border-t bg-muted/25 lg:max-h-none lg:h-full lg:min-h-0 lg:w-96 lg:max-w-[38%] lg:shrink-0 lg:border-l lg:border-t-0 xl:max-w-none"
      aria-labelledby="bulk-dup-panel-title"
    >
      <div className="border-border flex shrink-0 items-start justify-between gap-3 border-b px-4 py-3">
        <div className="min-w-0 space-y-1">
          <h2
            id="bulk-dup-panel-title"
            className="font-heading text-sm leading-tight font-semibold tracking-tight"
          >
            Same name as existing product
          </h2>
          <p className="text-muted-foreground text-xs leading-relaxed">
            Matches are case-insensitive. Rename or edit the import row, or remove
            it. At least one product must stay in the import.
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="shrink-0"
          onClick={onDismiss}
          aria-label="Close name review panel"
        >
          <X className="size-4" />
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3">
        <div className="space-y-5">
          {conflicts.map((c) => {
            const d = drafts[c.index];
            if (!d) return null;
            const exImg = primaryImageUrlForCatalogProduct(c.existing);
            return (
              <div
                key={c.index}
                className="border-border space-y-3 rounded-lg border bg-card p-3 shadow-sm"
              >
                <p className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
                  Row {c.index + 1} · in catalog
                </p>
                <div className="bg-muted/50 flex gap-3 rounded-md border px-2.5 py-2">
                  <BulkPreviewRowThumb src={exImg} label={c.existing.name} />
                  <div className="min-w-0 text-xs leading-snug">
                    <p className="font-medium text-foreground">
                      {c.existing.name}
                    </p>
                    <p className="text-muted-foreground mt-1.5 tabular-nums">
                      {formatInr(c.existing.price)} · Stock {c.existing.stock}
                      {c.existing.category ? (
                        <span> · {c.existing.category}</span>
                      ) : null}
                    </p>
                  </div>
                </div>
                <div className="space-y-3 border-t border-dashed pt-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-medium">Your import row</p>
                    <div className="flex items-center gap-2">
                      <Switch
                        id={`dup-remove-${c.index}`}
                        checked={removeIndices.has(c.index)}
                        onCheckedChange={(v) => toggleRemove(c.index, v)}
                      />
                      <Label
                        htmlFor={`dup-remove-${c.index}`}
                        className="cursor-pointer text-xs font-normal"
                      >
                        Remove from import
                      </Label>
                    </div>
                  </div>
                  {removeIndices.has(c.index) ? (
                    <p className="text-muted-foreground bg-muted/40 rounded-md border border-dashed px-3 py-2.5 text-xs leading-relaxed">
                      This line will be removed from the bulk JSON when you apply.
                    </p>
                  ) : (
                    <div className="grid gap-2.5">
                      <div className="grid gap-1.5">
                        <Label className="text-xs">Name</Label>
                        <Input
                          value={d.name}
                          onChange={(e) =>
                            updateDraft(c.index, { name: e.target.value })
                          }
                          className="h-9"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="grid min-w-0 gap-1.5">
                          <Label className="text-xs">Price</Label>
                          <Input
                            type="number"
                            step="0.01"
                            min={0}
                            value={d.price}
                            onChange={(e) =>
                              updateDraft(c.index, { price: e.target.value })
                            }
                            className="h-9"
                          />
                        </div>
                        <div className="grid min-w-0 gap-1.5">
                          <Label className="text-xs">Stock</Label>
                          <Input
                            type="number"
                            min={0}
                            step={1}
                            value={d.stock}
                            onChange={(e) =>
                              updateDraft(c.index, { stock: e.target.value })
                            }
                            className="h-9"
                          />
                        </div>
                      </div>
                      <div className="grid gap-1.5">
                        <Label className="text-xs">Category (optional)</Label>
                        <Input
                          value={d.category}
                          onChange={(e) =>
                            updateDraft(c.index, { category: e.target.value })
                          }
                          className="h-9"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          id={`dup-dep-${c.index}`}
                          checked={d.hasDeposit}
                          onCheckedChange={(v) =>
                            updateDraft(c.index, { hasDeposit: v })
                          }
                        />
                        <Label
                          htmlFor={`dup-dep-${c.index}`}
                          className="cursor-pointer text-xs"
                        >
                          Apply deposit
                        </Label>
                      </div>
                      <div className="grid gap-1.5">
                        <Label className="text-xs">Image URLs (one per line)</Label>
                        <Textarea
                          rows={3}
                          value={d.photoUrlsText}
                          onChange={(e) =>
                            updateDraft(c.index, {
                              photoUrlsText: e.target.value,
                            })
                          }
                          placeholder="https://..."
                          className="font-mono text-xs"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="border-border bg-background/95 supports-backdrop-filter:bg-background/80 flex shrink-0 flex-col-reverse gap-2 border-t px-4 py-3 backdrop-blur-sm sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onDismiss}>
          Cancel
        </Button>
        <Button type="button" onClick={handleSave}>
          {removeIndices.size > 0
            ? "Apply (save / remove rows)"
            : "Apply to JSON"}
        </Button>
      </div>
    </aside>
  );
}

function BulkPreviewRowThumb({
  src,
  label,
}: {
  src: string | null;
  label: string;
}) {
  const [broken, setBroken] = React.useState(false);
  React.useEffect(() => {
    setBroken(false);
  }, [src]);
  if (!src || broken) {
    return (
      <div
        className="bg-muted text-muted-foreground flex size-11 shrink-0 items-center justify-center rounded-md border"
        title={src ? "Image failed to load" : "No image"}
        aria-hidden
      >
        <ImageOff className="size-4 shrink-0" />
      </div>
    );
  }
  return (
    <Image
      src={src}
      alt={label ? `${label} preview` : ""}
      width={44}
      height={44}
      unoptimized
      className="size-11 shrink-0 rounded-md border object-cover"
      onError={() => setBroken(true)}
    />
  );
}

function ProductForm({
  initial,
  onDone,
  action,
  existingCatalogProducts = [],
  onBulkDupPanelOpenChange,
}: {
  initial?: ProductDto;
  onDone: () => void;
  action: (
    fd: FormData
  ) => Promise<{ ok: boolean; createdCount?: number; error?: unknown }>;
  /** Used to detect duplicate names when bulk-importing JSON. */
  existingCatalogProducts?: ProductDto[];
  /** Create dialog widens when the duplicate-name side panel is visible. */
  onBulkDupPanelOpenChange?: (open: boolean) => void;
}) {
  const [active, setActive] = React.useState(initial?.isActive !== false);
  const [hasDeposit, setHasDeposit] = React.useState(
    initial?.hasDeposit !== false
  );
  const [bulkProductsJson, setBulkProductsJson] = React.useState("");
  /** `preview` replaces the textarea with the list; `editor` shows the raw JSON field. */
  const [bulkJsonUi, setBulkJsonUi] = React.useState<"editor" | "preview">(
    "editor"
  );
  const [bulkDupModalOpen, setBulkDupModalOpen] = React.useState(false);
  const bulkDupAutoOpenedRef = React.useRef(false);
  const [photoUrls, setPhotoUrls] = React.useState<string[]>(
    initial?.photoUrls?.length
      ? initial.photoUrls
      : initial?.photoUrl
        ? [initial.photoUrl]
        : [""]
  );

  React.useEffect(() => {
    setActive(initial?.isActive !== false);
    setHasDeposit(initial?.hasDeposit !== false);
    setPhotoUrls(
      initial?.photoUrls?.length
        ? initial.photoUrls
        : initial?.photoUrl
          ? [initial.photoUrl]
          : [""]
    );
  }, [initial?.id, initial?.isActive, initial?.hasDeposit, initial?.photoUrl, initial?.photoUrls]);

  const updatePhotoUrl = (index: number, value: string) => {
    setPhotoUrls((prev) => prev.map((item, i) => (i === index ? value : item)));
  };

  const addPhotoField = () => {
    setPhotoUrls((prev) => [...prev, ""]);
  };

  const removePhotoField = (index: number) => {
    setPhotoUrls((prev) => {
      const next = prev.filter((_, i) => i !== index);
      return next.length ? next : [""];
    });
  };
  const isBulkMode = !initial && bulkProductsJson.trim().length > 0;

  const bulkJsonPreview = React.useMemo(() => {
    const raw = bulkProductsJson.trim();
    if (!raw) return { kind: "idle" as const };
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return { kind: "invalid-json" as const };
    }
    if (!Array.isArray(parsed)) return { kind: "not-array" as const };
    if (parsed.length === 0) return { kind: "empty-array" as const };
    const rows = parsed.map((item, index) => {
      const r = safeParseBulkProductItem(item);
      return { index, ...r };
    });
    return { kind: "rows" as const, rows };
  }, [bulkProductsJson]);

  const bulkJsonKindRef = React.useRef(bulkJsonPreview.kind);
  React.useEffect(() => {
    if (!bulkProductsJson.trim()) {
      setBulkJsonUi("editor");
    }
  }, [bulkProductsJson]);

  React.useEffect(() => {
    const prev = bulkJsonKindRef.current;
    const next = bulkJsonPreview.kind;
    if (next === "rows" && prev !== "rows") {
      setBulkJsonUi("preview");
    }
    if (next !== "rows") {
      setBulkJsonUi("editor");
    }
    bulkJsonKindRef.current = next;
  }, [bulkJsonPreview.kind]);

  const showBulkPreview =
    bulkJsonUi === "preview" && bulkJsonPreview.kind === "rows";

  const bulkNameConflicts = React.useMemo(() => {
    if (bulkJsonPreview.kind !== "rows" || initial) return [];
    const catalogMap = catalogByNormalizedName(existingCatalogProducts);
    const out: {
      index: number;
      existing: ProductDto;
      draft: ParsedBulkProduct;
    }[] = [];
    for (const row of bulkJsonPreview.rows) {
      if (!row.success) continue;
      const key = normalizeProductName(row.data.name);
      const existing = catalogMap.get(key);
      if (existing) {
        out.push({ index: row.index, existing, draft: row.data });
      }
    }
    return out;
  }, [bulkJsonPreview, existingCatalogProducts, initial]);

  const bulkNameConflictIndices = React.useMemo(
    () => new Set(bulkNameConflicts.map((c) => c.index)),
    [bulkNameConflicts]
  );

  React.useEffect(() => {
    if (!bulkProductsJson.trim()) {
      bulkDupAutoOpenedRef.current = false;
    }
  }, [bulkProductsJson]);

  React.useEffect(() => {
    if (
      showBulkPreview &&
      bulkNameConflicts.length > 0 &&
      !bulkDupAutoOpenedRef.current
    ) {
      setBulkDupModalOpen(true);
      bulkDupAutoOpenedRef.current = true;
    }
    if (bulkNameConflicts.length === 0) {
      bulkDupAutoOpenedRef.current = false;
    }
  }, [showBulkPreview, bulkNameConflicts.length]);

  const bulkSubmitBlocked =
    isBulkMode &&
    (bulkJsonPreview.kind === "invalid-json" ||
      bulkJsonPreview.kind === "not-array" ||
      bulkJsonPreview.kind === "empty-array" ||
      (bulkJsonPreview.kind === "rows" &&
        bulkJsonPreview.rows.some((r) => !r.success)) ||
      bulkNameConflicts.length > 0);

  const bulkDupPanelActive =
    !initial && bulkDupModalOpen && bulkNameConflicts.length > 0;

  React.useEffect(() => {
    onBulkDupPanelOpenChange?.(bulkDupPanelActive);
  }, [bulkDupPanelActive, onBulkDupPanelOpenChange]);

  const getActionErrorMessage = (error: unknown): string => {
    if (!error || typeof error !== "object") return "Check fields and try again";
    const root = (error as { root?: string[] }).root;
    if (Array.isArray(root) && root[0]) return root[0];

    for (const value of Object.values(error as Record<string, unknown>)) {
      if (Array.isArray(value) && value[0] && typeof value[0] === "string") {
        return value[0];
      }
    }
    return "Check fields and try again";
  };

  return (
    <div
      className={cn(
        "flex w-full min-w-0 flex-col",
        bulkDupPanelActive &&
          "h-full min-h-0 flex-1 lg:flex-row lg:items-stretch lg:gap-0"
      )}
    >
      <form
        className={cn(
          "grid min-w-0 gap-4 py-2",
          bulkDupPanelActive &&
            "min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 lg:max-h-full lg:min-w-0"
        )}
        action={async (fd) => {
          fd.set("isActive", active ? "true" : "false");
          fd.set("hasDeposit", hasDeposit ? "true" : "false");
          const r = await action(fd);
          if (!r.ok) {
            toast.error(getActionErrorMessage(r.error));
            return;
          }
          if (!initial && r.createdCount && r.createdCount > 1) {
            toast.success(`${r.createdCount} products created`);
          } else {
            toast.success(initial ? "Product updated" : "Product created");
          }
          onDone();
        }}
      >
      {initial ? <input type="hidden" name="id" value={initial.id} /> : null}
      {!initial ? (
        <div className="grid gap-2 rounded-lg border p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label htmlFor="p-bulk-json" className="cursor-default">
              {showBulkPreview
                ? "Bulk add — product preview"
                : "Bulk add via JSON (optional)"}
            </Label>
            <div className="flex flex-wrap gap-2">
              {showBulkPreview ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  onClick={() => setBulkJsonUi("editor")}
                >
                  <Braces className="mr-1.5 size-3.5" aria-hidden />
                  Edit JSON
                </Button>
              ) : null}
              {!showBulkPreview && bulkJsonPreview.kind === "rows" ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="shrink-0"
                  onClick={() => setBulkJsonUi("preview")}
                >
                  <LayoutList className="mr-1.5 size-3.5" aria-hidden />
                  Show preview
                </Button>
              ) : null}
            </div>
          </div>

          {showBulkPreview ? (
            <input type="hidden" name="bulkProductsJson" value={bulkProductsJson} />
          ) : (
            <Textarea
              id="p-bulk-json"
              name="bulkProductsJson"
              rows={6}
              value={bulkProductsJson}
              onChange={(e) => setBulkProductsJson(e.target.value)}
              placeholder={`[
  { "name": "20L Can", "price": 120, "stock": 30, "photoUrls": ["https://..."] },
  { "name": "10L Can", "price": 90, "stock": 20 }
]`}
            />
          )}

          <p className="text-muted-foreground text-xs">
            If this JSON is filled, it will create all items and ignore single-product
            fields below.
          </p>

          {showBulkPreview ? (
            <div className="space-y-2">
              {bulkNameConflicts.length > 0 ? (
                <div className="flex flex-wrap items-center gap-2 rounded-md border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-xs">
                  <AlertTriangle
                    className="size-3.5 shrink-0 text-amber-600"
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1 leading-relaxed">
                    <strong>{bulkNameConflicts.length}</strong> row(s) use the same
                    name as a product already in the catalog (ignoring case).
                    Open the side panel to fix or remove them.
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    onClick={() => setBulkDupModalOpen(true)}
                  >
                    Open review panel
                  </Button>
                </div>
              ) : null}
              <p className="text-muted-foreground text-xs">
                {bulkJsonPreview.rows.filter((r) => r.success).length} ready to
                create
                {bulkJsonPreview.rows.some((r) => !r.success)
                  ? ` · ${bulkJsonPreview.rows.filter((r) => !r.success).length} row(s) need fixes`
                  : ""}
              </p>
              <ul className="border-border max-h-72 divide-y overflow-auto rounded-md border text-xs">
                {bulkJsonPreview.rows.map((row) => (
                  <li
                    key={row.index}
                    className="flex gap-3 px-3 py-2.5 sm:items-start"
                  >
                    <span className="text-muted-foreground w-7 shrink-0 pt-0.5 text-right font-mono">
                      {row.index + 1}
                    </span>
                    <BulkPreviewRowThumb
                      src={
                        row.success
                          ? primaryImageUrlForBulkPreview(row.data)
                          : null
                      }
                      label={row.success ? row.data.name : ""}
                    />
                    {row.success ? (
                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="text-foreground font-medium leading-snug">
                          {row.data.name}
                        </p>
                        <p className="text-muted-foreground leading-relaxed">
                          <span className="tabular-nums">
                            {formatInr(row.data.price)}
                          </span>
                          {" · "}
                          <span>Stock {row.data.stock}</span>
                          {row.data.category ? (
                            <>
                              {" · "}
                              <span>Cat: {row.data.category}</span>
                            </>
                          ) : null}
                          {" · "}
                          <span>
                            Deposit:{" "}
                            {row.data.hasDeposit === false
                              ? "No"
                              : row.data.hasDeposit === true
                                ? "Yes"
                                : "Not set"}
                          </span>
                          {" · "}
                          <span>
                            Images:{" "}
                            {row.data.photoUrls?.length ??
                              (row.data.photoUrl ? 1 : 0)}
                          </span>
                        </p>
                      </div>
                    ) : (
                      <p className="text-destructive min-w-0 flex-1 leading-relaxed">
                        {row.error}
                      </p>
                    )}
                    <Badge
                      variant={
                        row.success && bulkNameConflictIndices.has(row.index)
                          ? "outline"
                          : row.success
                            ? "secondary"
                            : "destructive"
                      }
                      className={cn(
                        "h-5 shrink-0 self-start px-1.5 text-[10px] uppercase",
                        row.success &&
                          bulkNameConflictIndices.has(row.index) &&
                          "border-amber-500/60 text-amber-900 dark:text-amber-100"
                      )}
                    >
                      {row.success
                        ? bulkNameConflictIndices.has(row.index)
                          ? "Name clash"
                          : "OK"
                        : "Fix"}
                    </Badge>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {!showBulkPreview &&
          (bulkJsonPreview.kind === "invalid-json" ||
            bulkJsonPreview.kind === "not-array" ||
            bulkJsonPreview.kind === "empty-array") ? (
            <div className="space-y-2">
              {bulkJsonPreview.kind === "invalid-json" ? (
                <p className="text-destructive text-xs">
                  Invalid JSON — fix syntax (brackets, commas, quotes) to continue.
                </p>
              ) : null}
              {bulkJsonPreview.kind === "not-array" ? (
                <p className="text-destructive text-xs">
                  Root value must be an array of product objects.
                </p>
              ) : null}
              {bulkJsonPreview.kind === "empty-array" ? (
                <p className="text-destructive text-xs">
                  Array is empty — add at least one product object.
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
      {!isBulkMode ? (
        <>
          <div className="grid gap-2">
            <Label htmlFor="p-name">Name</Label>
            <Input
              id="p-name"
              name="name"
              required
              defaultValue={initial?.name}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="p-price">Price</Label>
              <Input
                id="p-price"
                name="price"
                type="number"
                step="0.01"
                min={0}
                required
                defaultValue={initial?.price ?? ""}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="p-stock">Stock</Label>
              <Input
                id="p-stock"
                name="stock"
                type="number"
                min={0}
                required
                defaultValue={initial?.stock ?? 0}
              />
            </div>
          </div>
          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label>Product images (optional)</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addPhotoField}
              >
                <Plus className="mr-2 size-4" />
                Add image
              </Button>
            </div>
            {photoUrls.map((url, index) => (
              <div key={`photo-url-${index}`} className="flex items-center gap-2">
                <Input
                  id={index === 0 ? "p-photo-url-0" : undefined}
                  name="photoUrls"
                  type="url"
                  placeholder="https://..."
                  value={url}
                  onChange={(e) => updatePhotoUrl(index, e.target.value)}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remove image ${index + 1}`}
                  onClick={() => removePhotoField(index)}
                  disabled={photoUrls.length === 1 && !url.trim()}
                >
                  <X className="size-4" />
                </Button>
              </div>
            ))}
            <input
              type="hidden"
              name="photoUrl"
              value={photoUrls.map((item) => item.trim()).find(Boolean) ?? ""}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="p-cat">Category (optional)</Label>
            <Input
              id="p-cat"
              name="category"
              defaultValue={initial?.category ?? ""}
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="p-has-deposit"
              checked={hasDeposit}
              onCheckedChange={setHasDeposit}
              aria-label="Product has deposit"
            />
            <Label htmlFor="p-has-deposit" className="cursor-pointer">
              Apply deposit for this product
            </Label>
          </div>
        </>
      ) : null}
      {initial ? (
        <div className="flex items-center gap-2">
          <Switch
            id="p-active"
            checked={active}
            onCheckedChange={setActive}
            aria-label="Product active"
          />
          <Label htmlFor="p-active" className="cursor-pointer">
            Active in catalog
          </Label>
        </div>
      ) : null}
      <DialogFooter>
        {initial ? (
          <Button type="submit">Save</Button>
        ) : (
          <>
            {!isBulkMode ? (
              <Button
                type="submit"
                name="submitMode"
                value="single"
                variant="outline"
              >
                Create single
              </Button>
            ) : null}
            <Button
              type="submit"
              name="submitMode"
              value={isBulkMode ? "bulk" : "single"}
              disabled={bulkSubmitBlocked}
              title={
                bulkSubmitBlocked
                  ? bulkNameConflicts.length > 0
                    ? "Resolve duplicate names (open review panel)"
                    : "Fix JSON errors before bulk create"
                  : undefined
              }
            >
              {isBulkMode ? "Bulk create (JSON)" : "Create"}
            </Button>
          </>
        )}
      </DialogFooter>
      </form>
      {bulkDupPanelActive ? (
        <BulkDuplicateNameSidePanel
          onDismiss={() => setBulkDupModalOpen(false)}
          conflicts={bulkNameConflicts}
          bulkProductsJson={bulkProductsJson}
          onApply={(next) => {
            setBulkProductsJson(next);
            setBulkDupModalOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}
