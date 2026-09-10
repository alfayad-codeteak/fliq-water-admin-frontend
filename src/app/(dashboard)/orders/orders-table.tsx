"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Image from "next/image";
import { format } from "date-fns";
import { ImageOff, LayoutGrid, LayoutList, Package, Plus, ShoppingCart, Truck } from "lucide-react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";

import {
  assignOrderToPartnerAction,
  cancelOrderAction,
  updateOrderStatusAction,
} from "@/lib/actions/orders";
import { refundReturnedCansAction } from "@/lib/actions/deposits";
import { clientFetch } from "@/lib/api/client-fetch";
import type {
  DeliveryPartnerDto,
  OrderDto,
  OrderItemDto,
  ProductDto,
} from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TableEmptyState } from "@/components/ui/data-table/table-empty-state";
import { TableFilterChips } from "@/components/ui/data-table/table-filter-chips";
import { TablePagination } from "@/components/ui/data-table/table-pagination";
import { TableSearchInput } from "@/components/ui/data-table/table-search-input";
import { TableStatCards } from "@/components/ui/data-table/table-stat-cards";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CreateOrderDialog } from "./create-order-dialog";

const NEXT_STATUS: Record<string, string | null> = {
  RECEIVED: "CONFIRMED",
  CONFIRMED: "PACKED",
  PACKED: "DISPATCHED",
  DISPATCHED: "DELIVERED",
};

const NEXT_STATUS_LABEL: Record<string, string> = {
  CONFIRMED: "Confirm order",
  PACKED: "Mark packed",
  DISPATCHED: "Dispatch",
  DELIVERED: "Mark delivered",
};

type StatusFilter =
  | "all"
  | "pending"
  | "in-transit"
  | "delivered"
  | "cancelled";

function getDeliveryStatus(order: OrderDto): string {
  return order.deliveryStatus?.trim() || "NONE";
}

/** Delivery pipeline finished — hide admin fulfilment actions even if `order.status` lags. */
function isTerminalDeliveryStatus(order: OrderDto): boolean {
  const ds = getDeliveryStatus(order);
  return ds === "DELIVERED" || ds === "CANS_RETURNED";
}

function formatDeliveryStatusLabel(s: string): string {
  return s.replace(/_/g, " ");
}

function orderCustomerName(order: OrderDto): string {
  const fromUser = order.user?.name?.trim();
  if (fromUser) return fromUser;
  const addr = order.address;
  const fromAddr =
    addr && typeof addr === "object" && typeof addr.name === "string"
      ? addr.name.trim()
      : "";
  return fromAddr || "—";
}

function canAssignDeliveryPartner(order: OrderDto): boolean {
  if (order.status === "CANCELLED") return false;
  const ds = getDeliveryStatus(order);
  if (
    ds === "PICKED_UP" ||
    ds === "DELIVERED" ||
    ds === "CANS_RETURNED"
  ) {
    return false;
  }
  return ds === "NONE" || ds === "ASSIGNED";
}

function deliveryStatusBadgeClass(ds: string): string {
  switch (ds) {
    case "NONE":
      return "border-muted-foreground/30 bg-muted text-muted-foreground";
    case "ASSIGNED":
      return "border-sky-300 bg-sky-100 text-sky-900 dark:border-sky-700 dark:bg-sky-950 dark:text-sky-100";
    case "PICKED_UP":
      return "border-violet-300 bg-violet-100 text-violet-900 dark:border-violet-700 dark:bg-violet-950 dark:text-violet-100";
    case "DELIVERED":
      return "border-emerald-300 bg-emerald-100 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-100";
    case "CANS_RETURNED":
      return "border-teal-300 bg-teal-100 text-teal-900 dark:border-teal-700 dark:bg-teal-950 dark:text-teal-100";
    default:
      return "border-border bg-muted text-muted-foreground";
  }
}

function getReturnableCansCount(order: OrderDto): number {
  return getReturnedCanCount(order);
}

function hasCanReturn(order: OrderDto): boolean {
  return getReturnableCansCount(order) > 0;
}

function getReturnedCanCount(order: OrderDto): number {
  if (order.ifCanRefund !== true) return 0;
  const raw = order.returnedCanCount;
  if (typeof raw !== "number" || Number.isNaN(raw) || raw <= 0) return 0;
  return Math.floor(raw);
}

export function OrdersTable({ initialData }: { initialData: OrderDto[] }) {
  const queryClient = useQueryClient();
  const { status } = useSession();
  const { data: rows = initialData, isFetching, isLoading } = useQuery({
    queryKey: ["admin-orders"],
    queryFn: async () => {
      const res = await clientFetch("/api/bff/admin/orders");
      if (!res.ok) throw new Error("Failed to load orders");
      return res.json() as Promise<OrderDto[]>;
    },
    initialData,
    initialDataUpdatedAt: Date.now(),
    enabled: status === "authenticated",
    refetchInterval: 60_000,
  });

  const { data: deliveryPartners = [] } = useQuery({
    queryKey: ["admin-delivery-partners"],
    queryFn: async () => {
      const res = await clientFetch("/api/bff/admin/delivery-partners");
      if (!res.ok) return [];
      return res.json() as Promise<DeliveryPartnerDto[]>;
    },
    enabled: status === "authenticated",
    staleTime: 60_000,
  });

  const { data: products = [] } = useQuery({
    queryKey: ["admin-products"],
    queryFn: async () => {
      const res = await clientFetch("/api/bff/admin/products");
      if (!res.ok) throw new Error("Failed to load products");
      return res.json() as Promise<ProductDto[]>;
    },
    enabled: status === "authenticated",
    staleTime: 60_000,
  });

  const photoByProductId = React.useMemo(() => {
    const m = new Map<string, string>();
    for (const p of products) {
      const fromList = p.photoUrls?.map((u) => u?.trim()).find(Boolean);
      const url = (fromList ?? p.photoUrl?.trim()) || null;
      if (url) m.set(p.id, url);
    }
    return m;
  }, [products]);

  const [createOpen, setCreateOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("all");
  const [pageIndex, setPageIndex] = React.useState(0);
  const [pageSize, setPageSize] = React.useState(10);
  const [view, setView] = React.useState<"cards" | "table">("cards");

  React.useEffect(() => {
    try {
      const saved = window.localStorage.getItem("neerbottle-orders-view");
      if (saved === "table" || saved === "cards") setView(saved);
    } catch {
      /* ignore */
    }
  }, []);

  const setOrdersView = (next: "cards" | "table") => {
    setView(next);
    try {
      window.localStorage.setItem("neerbottle-orders-view", next);
    } catch {
      /* ignore */
    }
  };

  const stats = React.useMemo(() => {
    const pending = rows.filter((o) =>
      ["RECEIVED", "CONFIRMED"].includes(o.status)
    ).length;
    const inTransit = rows.filter((o) =>
      ["PACKED", "DISPATCHED"].includes(o.status)
    ).length;
    const delivered = rows.filter((o) => o.status === "DELIVERED").length;
    const cancelled = rows.filter((o) => o.status === "CANCELLED").length;
    return { total: rows.length, pending, inTransit, delivered, cancelled };
  }, [rows]);

  const filtered = React.useMemo(() => {
    const q = search.toLowerCase().trim();
    return rows.filter((o) => {
      if (statusFilter === "pending" && !["RECEIVED", "CONFIRMED"].includes(o.status))
        return false;
      if (
        statusFilter === "in-transit" &&
        !["PACKED", "DISPATCHED"].includes(o.status)
      )
        return false;
      if (statusFilter === "delivered" && o.status !== "DELIVERED") return false;
      if (statusFilter === "cancelled" && o.status !== "CANCELLED") return false;
      if (!q) return true;
      const hay = [
        o.id,
        o.user?.name,
        orderCustomerName(o),
        o.user?.phone,
        o.status,
        o.statusLabel,
        getDeliveryStatus(o),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [rows, search, statusFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice(
    pageIndex * pageSize,
    pageIndex * pageSize + pageSize
  );

  React.useEffect(() => {
    setPageIndex(0);
  }, [search, statusFilter, pageSize]);

  const filterChips = [
    { id: "all", label: "All", count: stats.total },
    { id: "pending", label: "Pending", count: stats.pending },
    { id: "in-transit", label: "In transit", count: stats.inTransit },
    { id: "delivered", label: "Delivered", count: stats.delivered },
    { id: "cancelled", label: "Cancelled", count: stats.cancelled },
  ];

  return (
    <div className="space-y-5">
      <TableStatCards
        items={[
          { label: "Total orders", value: stats.total, icon: ShoppingCart },
          { label: "Pending", value: stats.pending, icon: Package },
          { label: "In transit", value: stats.inTransit, icon: Truck },
          { label: "Delivered", value: stats.delivered, icon: ShoppingCart },
        ]}
      />

      <div className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <TableSearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search customer, phone, status, or order id…"
            aria-label="Search orders"
          />
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-slate-200 bg-white p-0.5">
              <Button
                type="button"
                size="sm"
                variant={view === "cards" ? "secondary" : "ghost"}
                className="h-8 font-bold"
                aria-pressed={view === "cards"}
                onClick={() => setOrdersView("cards")}
              >
                <LayoutGrid className="mr-1.5 size-4" />
                Cards
              </Button>
              <Button
                type="button"
                size="sm"
                variant={view === "table" ? "secondary" : "ghost"}
                className="h-8 font-bold"
                aria-pressed={view === "table"}
                onClick={() => setOrdersView("table")}
              >
                <LayoutList className="mr-1.5 size-4" />
                Table
              </Button>
            </div>
            <Button type="button" size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 size-4" />
              Create order
            </Button>
          </div>
        </div>
        <TableFilterChips
          chips={filterChips}
          activeId={statusFilter}
          onChange={(id) => setStatusFilter(id as StatusFilter)}
        />
      </div>

      <CreateOrderDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        products={products}
      />

      <div className="space-y-3">
        {isLoading && rows.length === 0 ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-36 animate-pulse rounded-2xl border border-slate-200 bg-white"
              />
            ))}
          </div>
        ) : paged.length ? (
          view === "table" ? (
            <OrdersTableView
              orders={paged}
              photoByProductId={photoByProductId}
              deliveryPartners={deliveryPartners}
              isFetching={isFetching}
              onDone={() =>
                queryClient.invalidateQueries({ queryKey: ["admin-orders"] })
              }
            />
          ) : (
            <ul className="space-y-3">
              {paged.map((o) => (
                <li key={o.id}>
                  <OrderCard
                    order={o}
                    photoByProductId={photoByProductId}
                    deliveryPartners={deliveryPartners}
                    onDone={() =>
                      queryClient.invalidateQueries({ queryKey: ["admin-orders"] })
                    }
                  />
                </li>
              ))}
            </ul>
          )
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-white">
            <TableEmptyState
              icon={ShoppingCart}
              title="No orders found"
              description={
                search || statusFilter !== "all"
                  ? "Try adjusting your search or filters."
                  : "Create your first order to start fulfilment."
              }
              action={
                !search && statusFilter === "all"
                  ? {
                      label: "Create order",
                      onClick: () => setCreateOpen(true),
                    }
                  : undefined
              }
            />
          </div>
        )}

        <TablePagination
          pageIndex={pageIndex}
          pageCount={pageCount}
          pageSize={pageSize}
          totalItems={filtered.length}
          itemLabel="order"
          isFetching={isFetching}
          onPageSizeChange={setPageSize}
          onPrevious={() => setPageIndex((p) => Math.max(0, p - 1))}
          onNext={() => setPageIndex((p) => p + 1)}
          canPrevious={pageIndex > 0}
          canNext={pageIndex < pageCount - 1}
        />
      </div>
    </div>
  );
}

function OrdersTableView({
  orders,
  photoByProductId,
  deliveryPartners,
  isFetching,
  onDone,
}: {
  orders: OrderDto[];
  photoByProductId: Map<string, string>;
  deliveryPartners: DeliveryPartnerDto[];
  isFetching: boolean;
  onDone: () => void;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <Table className="min-w-[980px]" aria-busy={isFetching}>
        <TableHeader className="bg-slate-50">
          <TableRow className="hover:bg-transparent">
            <TableHead className="h-11 font-bold">Order</TableHead>
            <TableHead className="h-11 font-bold">Customer</TableHead>
            <TableHead className="h-11 font-bold">Items</TableHead>
            <TableHead className="h-11 font-bold">Status</TableHead>
            <TableHead className="h-11 font-bold">Driver</TableHead>
            <TableHead className="h-11 font-bold">Total</TableHead>
            <TableHead className="h-11 text-right font-bold">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((o) => {
            const ds = getDeliveryStatus(o);
            return (
              <TableRow key={o.id} className="align-top">
                <TableCell className="relative py-3 pl-5">
                  <StatusBeam status={o.status} />
                  <p className="font-mono text-sm font-bold">
                    #{o.orderNumber ?? o.id.slice(0, 8)}
                  </p>
                  <p className="text-xs font-semibold text-slate-500">
                    {format(new Date(o.createdAt), "d MMM · h:mm a")}
                  </p>
                </TableCell>
                <TableCell className="py-3">
                  <p className="text-sm font-bold">{orderCustomerName(o)}</p>
                  <p className="font-mono text-xs font-semibold text-slate-500">
                    {o.user?.phone ?? "—"}
                  </p>
                </TableCell>
                <TableCell className="max-w-[14rem] py-3">
                  <OrderItemsCell
                    order={o}
                    photoByProductId={photoByProductId}
                  />
                </TableCell>
                <TableCell className="py-3">
                  <div className="flex flex-col items-start gap-1.5">
                    <Badge
                      variant="outline"
                      className={cn("h-6 font-bold", statusBadgeClass(o.status))}
                    >
                      {o.statusLabel ?? o.status}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={cn("h-6 font-bold", deliveryStatusBadgeClass(ds))}
                    >
                      {ds === "NONE"
                        ? "Not assigned"
                        : formatDeliveryStatusLabel(ds)}
                    </Badge>
                  </div>
                </TableCell>
                <TableCell className="py-3">
                  {o.deliveryPartner ? (
                    <div>
                      <p className="text-sm font-bold">
                        {o.deliveryPartner.name}
                      </p>
                      <p className="font-mono text-xs font-semibold text-slate-500">
                        {o.deliveryPartner.phone}
                      </p>
                    </div>
                  ) : (
                    <span className="text-sm font-semibold text-slate-400">
                      —
                    </span>
                  )}
                </TableCell>
                <TableCell className="py-3 text-sm font-bold tabular-nums">
                  <OrderTotalHover order={o} />
                </TableCell>
                <TableCell className="py-3 text-right">
                  <OrderActions
                    order={o}
                    deliveryPartners={deliveryPartners}
                    onDone={onDone}
                    layout="inline"
                  />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function orderAddressHint(order: OrderDto): string | null {
  const a = order.address;
  if (!a || typeof a !== "object") return null;
  const city = typeof a.city === "string" ? a.city.trim() : "";
  const pin = typeof a.pincode === "string" ? a.pincode.trim() : "";
  const parts = [city, pin].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

function OrderCard({
  order,
  photoByProductId,
  deliveryPartners,
  onDone,
}: {
  order: OrderDto;
  photoByProductId: Map<string, string>;
  deliveryPartners: DeliveryPartnerDto[];
  onDone: () => void;
}) {
  const ds = getDeliveryStatus(order);
  const deliveryLabel =
    ds === "NONE" ? "Not assigned" : formatDeliveryStatusLabel(ds);
  const place = orderAddressHint(order);

  return (
    <article className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 pl-5 shadow-sm sm:p-5 sm:pl-6">
      <StatusBeam status={order.status} tall />
      <div className="flex flex-col gap-4 lg:flex-row lg:items-stretch lg:justify-between">
        <div className="min-w-0 flex-1 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-mono text-base font-bold text-slate-900">
                #{order.orderNumber ?? order.id.slice(0, 8)}
              </p>
              <p className="mt-0.5 text-sm font-semibold text-slate-600">
                {format(new Date(order.createdAt), "EEE, d MMM yyyy · h:mm a")}
                {order.timeSlot ? ` · ${order.timeSlot}` : ""}
              </p>
            </div>
            <OrderTotalHover order={order} align="right" size="lg" />
          </div>

          <div>
            <p className="text-base font-bold text-slate-900">
              {orderCustomerName(order) === "—"
                ? "Customer"
                : orderCustomerName(order)}
            </p>
            <p className="font-mono text-sm font-semibold text-slate-600">
              {order.user?.phone ?? "—"}
            </p>
            {place ? (
              <p className="mt-0.5 text-sm font-semibold text-slate-500">
                {place}
              </p>
            ) : null}
          </div>

          <OrderItemsCell order={order} photoByProductId={photoByProductId} />

          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl bg-slate-50 px-3 py-2">
              <dt className="text-[11px] font-bold tracking-wide text-slate-500 uppercase">
                Status
              </dt>
              <dd className="mt-1">
                <Badge
                  variant="outline"
                  className={cn("h-6 px-2.5 text-xs font-bold", statusBadgeClass(order.status))}
                >
                  {order.statusLabel ?? order.status}
                </Badge>
              </dd>
            </div>
            <div className="rounded-xl bg-slate-50 px-3 py-2">
              <dt className="text-[11px] font-bold tracking-wide text-slate-500 uppercase">
                Delivery
              </dt>
              <dd className="mt-1">
                <Badge
                  variant="outline"
                  className={cn(
                    "h-6 px-2.5 text-xs font-bold",
                    deliveryStatusBadgeClass(ds)
                  )}
                >
                  {deliveryLabel}
                </Badge>
              </dd>
            </div>
            <div className="rounded-xl bg-slate-50 px-3 py-2">
              <dt className="text-[11px] font-bold tracking-wide text-slate-500 uppercase">
                Driver
              </dt>
              <dd className="mt-1 text-sm font-bold text-slate-800">
                {order.deliveryPartner?.name ?? "None yet"}
              </dd>
              {order.deliveryPartner?.phone ? (
                <p className="font-mono text-xs font-semibold text-slate-500">
                  {order.deliveryPartner.phone}
                </p>
              ) : null}
            </div>
            <div className="rounded-xl bg-slate-50 px-3 py-2">
              <dt className="text-[11px] font-bold tracking-wide text-slate-500 uppercase">
                Deposit
              </dt>
              <dd className="mt-1 text-sm font-bold text-slate-800">
                {formatMoney(getDepositCharge(order))}
              </dd>
              <p className="text-xs font-semibold text-slate-500">
                {order.depositEnabled === false ? "Off" : "On"}
                {" · "}
                {getReturnableCansCount(order)} cans
              </p>
              {getHandlingTotal(order) > 0 ? (
                <p className="mt-1 text-xs font-semibold text-slate-600">
                  Handling {formatMoney(getHandlingTotal(order))}
                </p>
              ) : null}
            </div>
          </dl>
        </div>

        <div className="flex shrink-0 flex-col justify-end border-t border-slate-100 pt-3 lg:w-48 lg:border-t-0 lg:border-l lg:pl-5 lg:pt-0">
          <p className="mb-2 text-[11px] font-bold tracking-wide text-slate-500 uppercase">
            Actions
          </p>
          <OrderActions
            order={order}
            deliveryPartners={deliveryPartners}
            onDone={onDone}
          />
        </div>
      </div>
    </article>
  );
}

function normalizeOrderItems(order: OrderDto): OrderItemDto[] {
  const raw = order.items;
  if (!Array.isArray(raw)) return [];
  return raw.filter((i): i is OrderItemDto => i != null);
}

function itemDisplayName(item: OrderItemDto): string {
  return (
    item.productName?.trim() ||
    item.name?.trim() ||
    item.productId ||
    "Unnamed product"
  );
}

function itemUnitPrice(item: OrderItemDto): number | undefined {
  const p = item.unitPrice ?? item.price;
  return typeof p === "number" && !Number.isNaN(p) ? p : undefined;
}

function itemLineTotal(item: OrderItemDto): number | undefined {
  const q = item.quantity;
  const unit = itemUnitPrice(item);
  if (unit == null || q == null || q <= 0) return undefined;
  return unit * q;
}

function resolveItemImageUrl(
  item: OrderItemDto,
  photoByProductId: Map<string, string>
): string | null {
  const fromUrls = item.photoUrls?.map((u) => u?.trim()).find(Boolean);
  const direct = (fromUrls ?? item.photoUrl?.trim()) || null;
  if (direct) return direct;
  const pid = item.productId;
  if (pid && photoByProductId.has(pid)) {
    return photoByProductId.get(pid)!;
  }
  return null;
}

/** One image per distinct product, in line order. */
function uniqueOrderedImageUrls(
  items: OrderItemDto[],
  photoByProductId: Map<string, string>
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    const url = resolveItemImageUrl(item, photoByProductId);
    if (!url) continue;
    const key = item.productId ?? `u:${url}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(url);
  }
  return out;
}

function OrderItemThumb({
  src,
  alt,
  size = 36,
  className,
}: {
  src: string | null;
  alt: string;
  size?: number;
  className?: string;
}) {
  const [broken, setBroken] = React.useState(false);
  React.useEffect(() => {
    setBroken(false);
  }, [src]);
  if (!src || broken) {
    return (
      <div
        className={cn(
          "bg-muted text-muted-foreground flex shrink-0 items-center justify-center rounded-md border",
          className
        )}
        style={{ width: size, height: size }}
        role={alt ? "img" : undefined}
        aria-label={alt ? `${alt} (no image)` : undefined}
        aria-hidden={!alt}
      >
        <ImageOff className="size-3.5 shrink-0" aria-hidden />
      </div>
    );
  }
  return (
    <Image
      src={src}
      alt={alt}
      width={size}
      height={size}
      unoptimized
      className={cn("shrink-0 border object-cover", className)}
      onError={() => setBroken(true)}
    />
  );
}

function OrderItemsImageStack({
  urls,
  size = 36,
}: {
  urls: string[];
  size?: number;
}) {
  if (urls.length === 0) {
    return <OrderItemThumb src={null} alt="" size={size} />;
  }
  if (urls.length === 1) {
    return (
      <OrderItemThumb
        src={urls[0]!}
        alt=""
        size={size}
        className="rounded-md"
      />
    );
  }
  const maxShow = 4;
  const slice = urls.slice(0, maxShow);
  const overflow = urls.length - maxShow;
  return (
    <div className="flex items-center" aria-hidden>
      {slice.map((url, i) => (
        <div
          key={i}
          className={cn(
            "relative shrink-0 overflow-hidden rounded-full border-2 border-card bg-muted shadow-sm",
            i > 0 && "-ml-2.5"
          )}
          style={{
            width: size,
            height: size,
            zIndex: slice.length - i,
          }}
        >
          <Image
            src={url}
            alt=""
            fill
            unoptimized
            className="object-cover"
            sizes={`${size}px`}
          />
        </div>
      ))}
      {overflow > 0 ? (
        <div
          className="text-muted-foreground -ml-2.5 flex shrink-0 items-center justify-center rounded-full border-2 border-card bg-muted text-[10px] font-semibold tabular-nums"
          style={{ width: size, height: size, zIndex: 0 }}
        >
          +{overflow}
        </div>
      ) : null}
    </div>
  );
}

function OrderItemsCell({
  order,
  photoByProductId,
}: {
  order: OrderDto;
  photoByProductId: Map<string, string>;
}) {
  const items = normalizeOrderItems(order);
  const [open, setOpen] = React.useState(false);
  const count = items.length;
  const totalQty = items.reduce((s, i) => s + (i.quantity ?? 0), 0);
  const previewUrls = uniqueOrderedImageUrls(items, photoByProductId);

  if (count === 0) {
    return <span className="text-muted-foreground text-xs">—</span>;
  }

  const first = itemDisplayName(items[0]!);
  const subtitle =
    count === 1
      ? totalQty > 1
        ? `×${totalQty}`
        : null
      : `${first.length > 28 ? `${first.slice(0, 28)}…` : first} · +${count - 1} more`;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <div className="flex items-start gap-2.5">
        <div className="pt-0.5">
          <OrderItemsImageStack urls={previewUrls} size={36} />
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="min-w-0 flex-1 text-left text-sm underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
        <span className="text-primary font-medium">
          {count} {count === 1 ? "item" : "items"}
          {totalQty > 0 ? ` (${totalQty} pcs)` : ""}
        </span>
        {count > 1 ? (
          <span className="text-muted-foreground mt-0.5 block truncate text-xs font-normal no-underline">
            {subtitle}
          </span>
        ) : subtitle ? (
          <span className="text-muted-foreground mt-0.5 block text-xs font-normal no-underline">
            {first}
            {totalQty > 1 ? ` ×${totalQty}` : ""}
          </span>
        ) : (
          <span className="text-muted-foreground mt-0.5 block truncate text-xs font-normal no-underline">
            {first}
          </span>
        )}
        </button>
      </div>

      <DialogContent
        className="max-h-[min(85vh,36rem)] overflow-y-auto sm:max-w-xl"
        showCloseButton
      >
        <DialogHeader>
          <DialogTitle>Order items</DialogTitle>
          <DialogDescription>
            <span className="block">
              {format(new Date(order.createdAt), "MMM d, yyyy · HH:mm")}
            </span>
            {(orderCustomerName(order) !== "—" || order.user?.phone) ? (
              <span className="mt-1 block">
                {orderCustomerName(order) !== "—"
                  ? orderCustomerName(order)
                  : null}
                {order.user?.phone ? (
                  <span className="text-muted-foreground font-mono">
                    {" "}
                    · {order.user.phone}
                  </span>
                ) : null}
              </span>
            ) : null}
          </DialogDescription>
        </DialogHeader>
        <div className="border-border space-y-1.5 rounded-lg border bg-muted/35 px-3 py-2.5 text-xs">
          <p className="text-foreground font-semibold tracking-tight">
            Delivery
          </p>
          <p>
            <span className="text-muted-foreground">Status: </span>
            <span className="font-medium">
              {formatDeliveryStatusLabel(getDeliveryStatus(order))}
            </span>
          </p>
          {order.deliveryPartner ? (
            <>
              <p>
                <span className="text-muted-foreground">Driver: </span>
                <span className="font-medium">{order.deliveryPartner.name}</span>
                <span className="text-muted-foreground font-mono">
                  {" "}
                  · {order.deliveryPartner.phone}
                </span>
              </p>
              {order.assignedAt ? (
                <p className="text-muted-foreground">
                  Assigned{" "}
                  {format(new Date(order.assignedAt), "MMM d, yyyy · HH:mm")}
                </p>
              ) : null}
            </>
          ) : (
            <p className="text-muted-foreground">No driver assigned yet.</p>
          )}
          {order.deliveryNotes ? (
            <p className="text-muted-foreground border-border/60 border-t pt-1.5 italic">
              Partner note: {order.deliveryNotes}
            </p>
          ) : null}
        </div>
        <ul className="border-border divide-y rounded-lg border">
          {items.map((item, idx) => {
            const name = itemDisplayName(item);
            const qty = item.quantity ?? 0;
            const unit = itemUnitPrice(item);
            const line = itemLineTotal(item);
            const img = resolveItemImageUrl(item, photoByProductId);
            return (
              <li
                key={item.id ?? item.productId ?? `line-${idx}`}
                className="flex gap-3 px-3 py-2.5"
              >
                <OrderItemThumb
                  src={img}
                  alt={name}
                  size={44}
                  className="rounded-md"
                />
                <div className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium leading-snug">{name}</p>
                    {item.productId ? (
                      <p className="text-muted-foreground font-mono text-xs">
                        ID {item.productId}
                      </p>
                    ) : null}
                  </div>
                  <div className="shrink-0 text-left sm:text-right">
                    <p className="text-sm tabular-nums">
                      {qty > 0 ? `× ${qty}` : "—"}
                      {unit != null ? (
                        <span className="text-muted-foreground">
                          {" "}
                          @ {formatMoney(unit)}
                        </span>
                      ) : null}
                    </p>
                    {line != null ? (
                      <p className="text-muted-foreground text-xs tabular-nums">
                        Line {formatMoney(line)}
                      </p>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </DialogContent>
    </Dialog>
  );
}

function OrderActions({
  order,
  deliveryPartners,
  onDone,
  layout = "stack",
}: {
  order: OrderDto;
  deliveryPartners: DeliveryPartnerDto[];
  onDone: () => void;
  layout?: "stack" | "inline";
}) {
  const [pendingAction, setPendingAction] = React.useState<
    null | "status" | "cancel" | "refund" | "assign"
  >(null);
  const pending = pendingAction != null;
  const [assignOpen, setAssignOpen] = React.useState(false);
  const [partnerId, setPartnerId] = React.useState("");
  const status = order.status;
  const next = NEXT_STATUS[status] ?? null;
  const canCancel =
    status !== "DELIVERED" &&
    status !== "CANCELLED" &&
    status !== "DISPATCHED";
  const refunded = isDepositRefunded(order);
  const canRefund = status === "DELIVERED" && !refunded;
  const canAssign = canAssignDeliveryPartner(order);
  const hasAssignedPartner =
    Boolean(order.deliveryPartnerId || order.deliveryPartner?.id) ||
    getDeliveryStatus(order) === "ASSIGNED";
  const availablePartners = deliveryPartners.filter((p) => p.isAvailable !== false);
  const selectedPartner =
    deliveryPartners.find((p) => p.id === partnerId) ?? null;

  async function go(nextStatus: string) {
    setPendingAction("status");
    const r = await updateOrderStatusAction(order.id, nextStatus);
    setPendingAction(null);
    if (!r.ok) {
      toast.error(r.error ?? "Status update rejected");
      return;
    }
    toast.success("Order updated");
    onDone();
  }

  async function cancel() {
    setPendingAction("cancel");
    const r = await cancelOrderAction(order.id);
    setPendingAction(null);
    if (!r.ok) {
      toast.error(r.error ?? "Could not cancel");
      return;
    }
    toast.success("Order cancelled");
    onDone();
  }

  async function refundReturnedCans() {
    const raw = window.prompt("Returned cans count", "1");
    if (raw == null) return;
    const qty = Number(raw);
    if (!Number.isInteger(qty) || qty <= 0) {
      toast.error("Enter a valid positive integer");
      return;
    }
    setPendingAction("refund");
    const r = await refundReturnedCansAction(order.id, qty);
    setPendingAction(null);
    if (!r.ok) {
      toast.error(r.error ?? "Could not refund deposit");
      return;
    }
    toast.success("Deposit refunded");
    onDone();
  }

  async function assignPartner() {
    if (!partnerId) {
      toast.error("Choose a delivery partner");
      return;
    }
    setPendingAction("assign");
    const r = await assignOrderToPartnerAction(order.id, partnerId);
    setPendingAction(null);
    if (!r.ok) {
      toast.error(r.error ?? "Assignment failed");
      return;
    }
    toast.success("Driver assigned");
    setAssignOpen(false);
    setPartnerId("");
    onDone();
  }

  const compact = layout === "inline";
  const btnClass = compact
    ? "h-8 w-auto shrink-0 justify-center px-3 font-bold"
    : "h-10 w-full justify-center font-bold";
  const btnSize = compact ? "sm" : "lg";

  if (
    status === "DELIVERED" ||
    status === "CANCELLED" ||
    isTerminalDeliveryStatus(order)
  ) {
    return (
      <p className="text-sm font-bold text-slate-500">No actions needed</p>
    );
  }

  return (
    <div
      className={cn(
        compact ? "flex flex-wrap justify-end gap-1.5" : "flex flex-col gap-2"
      )}
    >
      {canAssign ? (
        <>
          <Button
            type="button"
            size={btnSize}
            variant="secondary"
            className={btnClass}
            disabled={pending}
            onClick={() => setAssignOpen(true)}
          >
            {hasAssignedPartner ? "Reassign driver" : "Assign driver"}
          </Button>
          <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
            <DialogContent className="sm:max-w-md" showCloseButton>
              <DialogHeader>
                <DialogTitle className="font-bold">Assign driver</DialogTitle>
                <DialogDescription className="font-semibold">
                  Choose an available partner. You can reassign only before pickup.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-3">
                <p className="text-sm font-bold">Partner</p>
                <Select
                  value={partnerId || null}
                  onValueChange={(value) => {
                    setPartnerId(typeof value === "string" ? value : "");
                  }}
                >
                  <SelectTrigger
                    id={`assign-${order.id}`}
                    className="h-auto min-h-10 w-full min-w-0 rounded-lg bg-white py-2 font-bold"
                  >
                    {selectedPartner ? (
                      <span className="flex min-w-0 flex-1 flex-col items-start gap-0.5 text-left">
                        <span className="truncate">{selectedPartner.name}</span>
                        <span className="text-muted-foreground font-mono text-xs font-semibold">
                          {selectedPartner.phone}
                        </span>
                      </span>
                    ) : (
                      <SelectValue placeholder="Choose a driver" />
                    )}
                  </SelectTrigger>
                  <SelectContent
                    align="start"
                    alignItemWithTrigger={false}
                    className="z-[80] min-w-(--anchor-width)"
                  >
                    {availablePartners.map((p) => (
                      <SelectItem
                        key={p.id}
                        value={p.id}
                        className="items-start py-2 font-bold"
                      >
                        <span className="flex min-w-0 flex-col">
                          <span>{p.name}</span>
                          <span className="text-muted-foreground font-mono text-xs font-semibold">
                            {p.phone}
                            {p.vehicleType || p.vehicleNumber
                              ? ` · ${[p.vehicleType, p.vehicleNumber].filter(Boolean).join(" ")}`
                              : ""}
                          </span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedPartner ? (
                  <div className="border-border rounded-lg border bg-muted/40 px-3 py-2.5 text-sm">
                    <p className="text-foreground font-bold">
                      {selectedPartner.name}
                    </p>
                    <p className="text-muted-foreground mt-0.5 font-mono text-xs font-semibold">
                      {selectedPartner.phone}
                    </p>
                    {(selectedPartner.vehicleType ||
                      selectedPartner.vehicleNumber) ? (
                      <p className="mt-1.5 font-semibold">
                        {[selectedPartner.vehicleType, selectedPartner.vehicleNumber]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    ) : (
                      <p className="text-muted-foreground mt-1.5 text-xs font-semibold">
                        No vehicle details on file
                      </p>
                    )}
                    <p className="mt-1.5 text-xs font-semibold">
                      {selectedPartner.isAvailable === false
                        ? "Currently offline"
                        : "Available for assignment"}
                    </p>
                  </div>
                ) : null}
                {availablePartners.length === 0 ? (
                  <p className="text-muted-foreground text-xs font-semibold">
                    No available drivers. Add or enable partners under Drivers.
                  </p>
                ) : null}
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setAssignOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  loading={pendingAction === "assign"}
                  loadingText="Assigning…"
                  disabled={pending || !partnerId}
                  onClick={() => assignPartner()}
                >
                  Assign
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      ) : null}
      {next && !hasAssignedPartner ? (
        <Button
          type="button"
          size={btnSize}
          variant="outline"
          className={cn(btnClass, nextStatusButtonClass(next))}
          loading={pendingAction === "status"}
          disabled={pending}
          onClick={() => go(next)}
        >
          {NEXT_STATUS_LABEL[next] ?? next}
        </Button>
      ) : null}
      {canCancel ? (
        <Button
          type="button"
          size={btnSize}
          variant="outline"
          className={cn(btnClass, "text-rose-700 hover:bg-rose-50")}
          loading={pendingAction === "cancel"}
          loadingText="Cancelling…"
          disabled={pending}
          onClick={() => cancel()}
        >
          Cancel order
        </Button>
      ) : null}
      {canRefund ? (
        <Button
          type="button"
          size={btnSize}
          variant="outline"
          className={btnClass}
          loading={pendingAction === "refund"}
          loadingText="Refunding…"
          disabled={pending}
          onClick={() => refundReturnedCans()}
        >
          Refund cans
        </Button>
      ) : null}
    </div>
  );
}

function getHandlingTotal(order: OrderDto): number {
  const n = order.handlingTotal;
  if (typeof n !== "number" || !Number.isFinite(n) || n <= 0) return 0;
  return n;
}

function getDepositCharge(order: OrderDto): number {
  return (
    order.depositCharge ??
    order.deposit?.charge ??
    0
  );
}

function getDepositDiscount(order: OrderDto): number {
  const n = order.depositDiscount ?? order.deposit?.discount ?? 0;
  return typeof n === "number" && Number.isFinite(n) && n > 0 ? n : 0;
}

function getDepositBase(order: OrderDto): number {
  const n = order.depositBase;
  if (typeof n === "number" && Number.isFinite(n) && n > 0) return n;
  const charge = getDepositCharge(order);
  const discount = getDepositDiscount(order);
  const sum = charge + discount;
  return sum > 0 ? sum : 0;
}

function getItemsSubtotal(order: OrderDto): number {
  const fromLines = (order.items ?? []).reduce((sum, item) => {
    const line = itemLineTotal(item);
    return sum + (line ?? 0);
  }, 0);
  if (fromLines > 0) return fromLines;
  const total = getOrderTotal(order);
  return Math.max(0, total - getHandlingTotal(order) - getDepositCharge(order));
}

function OrderTotalHover({
  order,
  align = "left",
  size = "sm",
}: {
  order: OrderDto;
  align?: "left" | "right";
  size?: "sm" | "lg";
}) {
  const items = getItemsSubtotal(order);
  const handling = getHandlingTotal(order);
  const depositBase = getDepositBase(order);
  const depositDiscount = getDepositDiscount(order);
  const deposit = getDepositCharge(order);
  const total = getOrderTotal(order);
  const lines = [
    { label: "Items", value: items },
    ...(handling > 0 ? [{ label: "Handling", value: handling }] : []),
    ...(depositBase > 0 && depositDiscount > 0
      ? [{ label: "Deposit", value: depositBase }]
      : []),
    ...(depositDiscount > 0
      ? [{ label: "Deposit discount", value: -depositDiscount }]
      : []),
    ...(deposit > 0 && !(depositBase > 0 && depositDiscount > 0)
      ? [{ label: "Deposit", value: deposit }]
      : []),
  ];

  return (
    <Tooltip>
      <TooltipTrigger
        type="button"
        className={cn(
          "cursor-help rounded-md outline-none focus-visible:ring-2 focus-visible:ring-sky-400/50",
          align === "right" && "ml-auto text-right"
        )}
      >
        <p
          className={cn(
            "tabular-nums",
            size === "lg"
              ? "text-lg font-bold text-slate-900"
              : "text-sm font-bold"
          )}
        >
          {formatMoney(total)}
        </p>
        {handling > 0 ? (
          <p className="mt-0.5 text-xs font-semibold text-slate-500">
            Handling {formatMoney(handling)}
          </p>
        ) : null}
      </TooltipTrigger>
      <TooltipContent
        side="left"
        align="end"
        className="max-w-[240px] flex-col items-stretch gap-0 rounded-xl px-3 py-2.5 text-left"
      >
        <p className="mb-1.5 text-[10px] font-bold tracking-wide uppercase opacity-70">
          Price breakdown
        </p>
        <ul className="space-y-1">
          {lines.map((row) => (
            <li
              key={row.label}
              className="flex items-center justify-between gap-6 text-xs"
            >
              <span className="opacity-80">{row.label}</span>
              <span className="font-semibold tabular-nums">
                {row.value < 0
                  ? `− ${formatMoney(Math.abs(row.value))}`
                  : formatMoney(row.value)}
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-1.5 flex items-center justify-between gap-6 border-t border-background/20 pt-1.5 text-xs font-bold">
          <span>Total</span>
          <span className="tabular-nums">{formatMoney(total)}</span>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

function getOrderTotal(order: OrderDto): number {
  return order.totalAmount ?? order.total ?? order.amount ?? 0;
}

function isDepositRefunded(order: OrderDto): boolean {
  return (
    order.depositRefunded === true ||
    order.deposit?.refunded === true ||
    (order.depositRefundAmount ?? order.deposit?.refundedAmount ?? 0) > 0
  );
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value);
}

function StatusBeam({
  status,
  tall = false,
}: {
  status: string;
  tall?: boolean;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "pointer-events-none absolute top-1.5 bottom-1.5 left-0 w-1.5 overflow-hidden rounded-r-full",
        tall && "top-0 bottom-0 rounded-none",
        statusBeamClass(status)
      )}
    >
      <span className="absolute inset-0 bg-gradient-to-b from-white/70 via-white/10 to-transparent" />
    </span>
  );
}

function statusBeamClass(status: string): string {
  switch (status) {
    case "RECEIVED":
      return "bg-slate-400 shadow-[0_0_16px_rgba(148,163,184,0.9)]";
    case "CONFIRMED":
      return "bg-blue-500 shadow-[0_0_18px_rgba(59,130,246,0.95)]";
    case "PACKED":
      return "bg-violet-500 shadow-[0_0_18px_rgba(139,92,246,0.95)]";
    case "DISPATCHED":
      return "bg-amber-500 shadow-[0_0_18px_rgba(245,158,11,0.95)]";
    case "DELIVERED":
      return "bg-emerald-500 shadow-[0_0_18px_rgba(16,185,129,0.95)]";
    case "CANCELLED":
      return "bg-rose-500 shadow-[0_0_18px_rgba(244,63,94,0.95)]";
    default:
      return "bg-slate-300 shadow-[0_0_12px_rgba(203,213,225,0.8)]";
  }
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case "RECEIVED":
      return "border-slate-300 bg-slate-100 text-slate-800";
    case "CONFIRMED":
      return "border-blue-300 bg-blue-100 text-blue-800";
    case "PACKED":
      return "border-violet-300 bg-violet-100 text-violet-800";
    case "DISPATCHED":
      return "border-amber-300 bg-amber-100 text-amber-800";
    case "DELIVERED":
      return "border-emerald-300 bg-emerald-100 text-emerald-800";
    case "CANCELLED":
      return "border-rose-300 bg-rose-100 text-rose-800";
    default:
      return "border-border bg-muted text-muted-foreground";
  }
}

function nextStatusButtonClass(status: string): string {
  switch (status) {
    case "CONFIRMED":
      return "border-blue-300 bg-blue-100 text-blue-800 hover:bg-blue-200";
    case "PACKED":
      return "border-violet-300 bg-violet-100 text-violet-800 hover:bg-violet-200";
    case "DISPATCHED":
      return "border-amber-300 bg-amber-100 text-amber-800 hover:bg-amber-200";
    case "DELIVERED":
      return "border-emerald-300 bg-emerald-100 text-emerald-800 hover:bg-emerald-200";
    case "CANCELLED":
      return "border-rose-300 bg-rose-100 text-rose-800 hover:bg-rose-200";
    default:
      return "";
  }
}
