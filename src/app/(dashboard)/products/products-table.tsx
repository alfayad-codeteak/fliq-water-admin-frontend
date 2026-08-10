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
  ChevronLeft,
  ChevronRight,
  Columns3,
  ImageOff,
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
  productHandlingFee,
  productMrp,
  productSalePrice,
} from "@/lib/products/product-price";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
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
  RightSidebar,
  RightSidebarActions,
} from "@/components/ui/right-sidebar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
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
  salePrice: "Sale price",
  mrp: "MRP",
  handlingFee: "Handling fee",
  stock: "Stock",
  deposit: "Deposit",
  isActive: "Visible",
  updatedAt: "Updated",
};

type StatusFilter = "all" | "active" | "hidden" | "low" | "out";

type BulkDraftFields = {
  salePrice: string;
  mrp: string;
  handlingFee: string;
  stock: string;
};

type BulkDraftField = keyof BulkDraftFields;

type BulkDraftContextValue = {
  drafts: Record<string, BulkDraftFields>;
  onFieldChange: (
    product: ProductDto,
    field: BulkDraftField,
    value: string
  ) => void;
};

const BulkDraftContext = React.createContext<BulkDraftContextValue | null>(
  null
);

function useBulkDraftContext() {
  const ctx = React.useContext(BulkDraftContext);
  if (!ctx) {
    throw new Error("useBulkDraftContext must be used within BulkDraftContext");
  }
  return ctx;
}

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

/** Stable inline editor — keeps focus while typing (columns must not remount). */
function InlineMoneyCell({
  product,
  field,
  original,
  ariaLabel,
  inputClassName,
  placeholder,
}: {
  product: ProductDto;
  field: "salePrice" | "mrp" | "handlingFee";
  original: number | null;
  ariaLabel: string;
  inputClassName?: string;
  placeholder?: string;
}) {
  const { drafts, onFieldChange } = useBulkDraftContext();
  const draft = drafts[product.id];
  const current =
    draft?.[field] !== undefined
      ? draft[field]
      : original == null
        ? ""
        : String(original);

  const changed = React.useMemo(() => {
    if (draft?.[field] === undefined) return false;
    if (field === "mrp") {
      const raw = draft.mrp.trim();
      const next = raw === "" ? null : Number(raw);
      return (next ?? null) !== (original ?? null);
    }
    return Number(draft[field]) !== (original ?? 0);
  }, [draft, field, original]);

  return (
    <div className="space-y-1">
      <Input
        type="number"
        step="0.01"
        min={0}
        value={current}
        onChange={(e) => onFieldChange(product, field, e.target.value)}
        placeholder={placeholder}
        className={cn(
          "h-8 tabular-nums",
          inputClassName,
          changed &&
            "border-amber-500/60 bg-amber-500/5 ring-1 ring-amber-500/20"
        )}
        aria-label={ariaLabel}
      />
      {!changed && original != null ? (
        <p className="text-muted-foreground text-[11px] tabular-nums">
          {formatInr(original)}
        </p>
      ) : null}
    </div>
  );
}

function InlineStockCell({ product }: { product: ProductDto }) {
  const { drafts, onFieldChange } = useBulkDraftContext();
  const draft = drafts[product.id];
  const current = draft?.stock ?? String(product.stock);
  const stockNum = Number(current);
  const meta = getStockMeta(Number.isFinite(stockNum) ? stockNum : 0);
  const changed =
    draft?.stock !== undefined && Number(draft.stock) !== product.stock;

  return (
    <div className="space-y-1.5">
      <Input
        type="number"
        min={0}
        step="1"
        value={current}
        onChange={(e) => onFieldChange(product, "stock", e.target.value)}
        className={cn(
          "h-8 w-20 tabular-nums",
          changed &&
            "border-amber-500/60 bg-amber-500/5 ring-1 ring-amber-500/20"
        )}
        aria-label={`Stock for ${product.name}`}
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
    initialDataUpdatedAt: Date.now(),
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
    Record<string, BulkDraftFields>
  >({});

  const [createOpen, setCreateOpen] = React.useState(false);
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
    (product: ProductDto, field: BulkDraftField, value: string) => {
      setBulkDrafts((prev) => {
        const mrp = productMrp(product);
        const existing = prev[product.id] ?? {
          salePrice: String(productSalePrice(product)),
          mrp: mrp == null ? "" : String(mrp),
          handlingFee: String(productHandlingFee(product)),
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

  const bulkDraftContextValue = React.useMemo(
    () => ({ drafts: bulkDrafts, onFieldChange: onBulkFieldChange }),
    [bulkDrafts, onBulkFieldChange]
  );

  const changedItems = React.useMemo(() => {
    const byId = new Map(rows.map((row) => [row.id, row]));
    const items: Array<{
      id: string;
      salePrice: number;
      price: number;
      mrp: number | null;
      handlingFee: number;
      stock: number;
    }> = [];

    for (const [id, draft] of Object.entries(bulkDrafts)) {
      const original = byId.get(id);
      if (!original) continue;
      const salePrice = Number(draft.salePrice);
      const stock = Number(draft.stock);
      const handlingFee = Number(draft.handlingFee);
      const mrpRaw = draft.mrp.trim();
      const mrp =
        mrpRaw === "" ? null : Number(mrpRaw);
      const isSaleValid = Number.isFinite(salePrice) && salePrice >= 0;
      const isStockValid = Number.isInteger(stock) && stock >= 0;
      const isHandlingValid =
        Number.isFinite(handlingFee) && handlingFee >= 0;
      const isMrpValid =
        mrp === null || (Number.isFinite(mrp) && (mrp as number) >= 0);
      if (!isSaleValid || !isStockValid || !isHandlingValid || !isMrpValid) {
        continue;
      }
      const origSale = productSalePrice(original);
      const origMrp = productMrp(original);
      const origFee = productHandlingFee(original);
      if (
        salePrice !== origSale ||
        stock !== original.stock ||
        handlingFee !== origFee ||
        mrp !== origMrp
      ) {
        items.push({
          id,
          salePrice,
          price: salePrice,
          mrp,
          handlingFee,
          stock,
        });
      }
    }
    return items;
  }, [bulkDrafts, rows]);

  const hasInvalidDrafts = React.useMemo(() => {
    return Object.entries(bulkDrafts).some(([, draft]) => {
      const salePrice = Number(draft.salePrice);
      const stock = Number(draft.stock);
      const handlingFee = Number(draft.handlingFee);
      const mrpRaw = draft.mrp.trim();
      const mrpOk =
        mrpRaw === "" ||
        (Number.isFinite(Number(mrpRaw)) && Number(mrpRaw) >= 0);
      return !(
        Number.isFinite(salePrice) &&
        salePrice >= 0 &&
        Number.isInteger(stock) &&
        stock >= 0 &&
        Number.isFinite(handlingFee) &&
        handlingFee >= 0 &&
        mrpOk
      );
    });
  }, [bulkDrafts]);

  const handleBulkSave = React.useCallback(async () => {
    if (hasInvalidDrafts) {
      toast.error("Fix invalid pricing/stock values before saving");
      return;
    }
    if (changedItems.length === 0) {
      toast.message("No bulk changes to save");
      return;
    }

    setBulkSaving(true);
    const result = await bulkUpdateProductsAction({
      items: changedItems.map((item) => ({
        id: item.id,
        salePrice: item.salePrice,
        price: item.salePrice,
        mrp: item.mrp,
        handlingFee: item.handlingFee,
        stock: item.stock,
      })),
    });
    setBulkSaving(false);

    if (!result.ok) {
      const root = "root" in result.error ? result.error.root?.[0] : undefined;
      toast.error(root ?? "Bulk update failed");
      return;
    }

    toast.success(
      `Updated ${result.data.count} product${result.data.count === 1 ? "" : "s"}`
    );
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
        id: "salePrice",
        accessorFn: (row) => productSalePrice(row),
        header: ({ column }) => (
          <SortHeader
            label="Sale price"
            sorted={column.getIsSorted()}
            onToggle={() =>
              column.toggleSorting(column.getIsSorted() === "asc")
            }
          />
        ),
        cell: ({ row }) => (
          <InlineMoneyCell
            product={row.original}
            field="salePrice"
            original={productSalePrice(row.original)}
            ariaLabel={`Sale price for ${row.original.name}`}
            inputClassName="w-28"
          />
        ),
      },
      {
        id: "mrp",
        accessorFn: (row) => productMrp(row) ?? -1,
        header: ({ column }) => (
          <SortHeader
            label="MRP"
            sorted={column.getIsSorted()}
            onToggle={() =>
              column.toggleSorting(column.getIsSorted() === "asc")
            }
          />
        ),
        cell: ({ row }) => (
          <InlineMoneyCell
            product={row.original}
            field="mrp"
            original={productMrp(row.original)}
            ariaLabel={`MRP for ${row.original.name}`}
            inputClassName="w-24"
            placeholder="—"
          />
        ),
      },
      {
        id: "handlingFee",
        accessorFn: (row) => productHandlingFee(row),
        header: ({ column }) => (
          <SortHeader
            label="Handling"
            sorted={column.getIsSorted()}
            onToggle={() =>
              column.toggleSorting(column.getIsSorted() === "asc")
            }
          />
        ),
        cell: ({ row }) => (
          <InlineMoneyCell
            product={row.original}
            field="handlingFee"
            original={productHandlingFee(row.original)}
            ariaLabel={`Handling fee for ${row.original.name}`}
            inputClassName="w-24"
          />
        ),
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
        cell: ({ row }) => <InlineStockCell product={row.original} />,
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
    [depositConfig, handleToggleActive, togglingId]
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
    <BulkDraftContext.Provider value={bulkDraftContextValue}>
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
              loading={bulkSaving}
              loadingText="Saving…"
              onClick={() => void handleBulkSave()}
              disabled={bulkSaving || changedItems.length === 0}
            >
              {`Save changes (${changedItems.length})`}
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
          <Table className="min-w-[1100px]" aria-busy={isFetching}>
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

      <RightSidebar
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="New product"
        description="Add a new catalog item."
        size="lg"
      >
        <ProductForm
          existingCategories={categories}
          onDone={() => {
            setCreateOpen(false);
            queryClient.invalidateQueries({ queryKey: ["admin-products"] });
          }}
          action={createProductAction}
        />
      </RightSidebar>

      <RightSidebar
        open={!!editRow}
        onOpenChange={(o) => !o && setEditRow(null)}
        title="Edit product"
        description="Update this catalog item."
        size="lg"
      >
        {editRow ? (
          <ProductForm
            initial={editRow}
            existingCategories={categories}
            onDone={() => {
              setEditRow(null);
              queryClient.invalidateQueries({ queryKey: ["admin-products"] });
            }}
            action={updateProductAction}
          />
        ) : null}
      </RightSidebar>

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
              loading={deleting}
              loadingText="Deleting…"
              onClick={async () => {
                if (!deleteRow || deleting) return;
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
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
    </BulkDraftContext.Provider>
  );
}



function ProductForm({
  initial,
  onDone,
  action,
  existingCategories = [],
}: {
  initial?: ProductDto;
  onDone: () => void;
  action: (
    fd: FormData
  ) => Promise<{ ok: boolean; createdCount?: number; error?: unknown }>;
  existingCategories?: string[];
}) {
  const initialCategory = initial?.category?.trim() ?? "";
  const [active, setActive] = React.useState(initial?.isActive !== false);
  const [hasDeposit, setHasDeposit] = React.useState(
    initial?.hasDeposit !== false
  );
  const [categoryMode, setCategoryMode] = React.useState<"pick" | "new">(() => {
    if (!initialCategory) return "pick";
    if (existingCategories.includes(initialCategory)) return "pick";
    return "new";
  });
  const [categoryPick, setCategoryPick] = React.useState(() => {
    if (!initialCategory) return "";
    if (existingCategories.includes(initialCategory)) return initialCategory;
    return "";
  });
  const [categoryNew, setCategoryNew] = React.useState(() => {
    if (!initialCategory) return "";
    if (existingCategories.includes(initialCategory)) return "";
    return initialCategory;
  });
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
    const cat = initial?.category?.trim() ?? "";
    if (!cat) {
      setCategoryMode("pick");
      setCategoryPick("");
      setCategoryNew("");
    } else if (existingCategories.includes(cat)) {
      setCategoryMode("pick");
      setCategoryPick(cat);
      setCategoryNew("");
    } else {
      setCategoryMode("new");
      setCategoryPick("");
      setCategoryNew(cat);
    }
    setPhotoUrls(
      initial?.photoUrls?.length
        ? initial.photoUrls
        : initial?.photoUrl
          ? [initial.photoUrl]
          : [""]
    );
  }, [
    initial?.id,
    initial?.isActive,
    initial?.hasDeposit,
    initial?.category,
    initial?.photoUrl,
    initial?.photoUrls,
    existingCategories,
  ]);

  const categoryValue =
    categoryMode === "new" ? categoryNew.trim() : categoryPick.trim();

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
    <form
      className="grid min-w-0 gap-4 py-2"
      action={async (fd) => {
        fd.set("isActive", active ? "true" : "false");
        fd.set("hasDeposit", hasDeposit ? "true" : "false");
        fd.set("category", categoryValue);
        const r = await action(fd);
        if (!r.ok) {
          toast.error(getActionErrorMessage(r.error));
          return;
        }
        toast.success(initial ? "Product updated" : "Product created");
        onDone();
      }}
    >
      {initial ? <input type="hidden" name="id" value={initial.id} /> : null}
      <input type="hidden" name="category" value={categoryValue} />
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
          <Label htmlFor="p-sale-price">Sale price</Label>
          <Input
            id="p-sale-price"
            name="salePrice"
            type="number"
            step="0.01"
            min={0}
            required
            defaultValue={initial ? productSalePrice(initial) : ""}
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
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="p-mrp">MRP (optional)</Label>
          <Input
            id="p-mrp"
            name="mrp"
            type="number"
            step="0.01"
            min={0}
            defaultValue={
              initial && productMrp(initial) != null ? productMrp(initial)! : ""
            }
            placeholder="—"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="p-handling-fee">Handling fee</Label>
          <Input
            id="p-handling-fee"
            name="handlingFee"
            type="number"
            step="0.01"
            min={0}
            defaultValue={initial ? productHandlingFee(initial) : 0}
          />
          <p className="text-muted-foreground text-[11px]">
            Catalog only — not included in order totals yet.
          </p>
        </div>
      </div>
      <div className="grid gap-2">
        <div className="flex items-center justify-between">
          <Label>Product images (optional)</Label>
          <Button type="button" variant="outline" size="sm" onClick={addPhotoField}>
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
        <select
          id="p-cat"
          className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
          value={categoryMode === "new" ? "__new__" : categoryPick}
          onChange={(e) => {
            const v = e.target.value;
            if (v === "__new__") {
              setCategoryMode("new");
              return;
            }
            setCategoryMode("pick");
            setCategoryPick(v);
            setCategoryNew("");
          }}
        >
          <option value="">No category</option>
          {existingCategories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
          <option value="__new__">+ Add new category…</option>
        </select>
        {categoryMode === "new" ? (
          <Input
            id="p-cat-new"
            value={categoryNew}
            onChange={(e) => setCategoryNew(e.target.value)}
            placeholder="e.g. Mid size water"
            autoFocus
          />
        ) : null}
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
      <RightSidebarActions>
        <SubmitButton loadingText={initial ? "Saving…" : "Creating…"}>
          {initial ? "Save" : "Create"}
        </SubmitButton>
      </RightSidebarActions>
    </form>
  );
}
