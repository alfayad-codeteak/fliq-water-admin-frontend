"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Image from "next/image";
import { format } from "date-fns";
import { ImageOff } from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const NEXT_STATUS: Record<string, string | null> = {
  RECEIVED: "CONFIRMED",
  CONFIRMED: "PACKED",
  PACKED: "DISPATCHED",
  DISPATCHED: "DELIVERED",
};

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
  const { data: rows = initialData, isFetching } = useQuery({
    queryKey: ["admin-orders"],
    queryFn: async () => {
      const res = await clientFetch("/api/bff/admin/orders");
      if (!res.ok) throw new Error("Failed to load orders");
      return res.json() as Promise<OrderDto[]>;
    },
    initialData,
    enabled: status === "authenticated",
    refetchInterval: 25_000,
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

  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <Table className="min-w-[1020px]" aria-busy={isFetching}>
        <TableHeader>
          <TableRow>
            <TableHead>When</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Items</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Delivery</TableHead>
            <TableHead>Driver</TableHead>
            <TableHead className="text-center">Deposit mode</TableHead>
            <TableHead className="text-center">Deposit</TableHead>
            <TableHead className="text-center">Returnable cans</TableHead>
            <TableHead>Total</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={11} className="text-muted-foreground h-24 text-center">
                No orders to show yet.
              </TableCell>
            </TableRow>
          ) : (
            rows.map((o) => (
              <TableRow key={o.id}>
                <TableCell className="whitespace-nowrap text-sm">
                  {format(new Date(o.createdAt), "MMM d, HH:mm")}
                </TableCell>
                <TableCell>
                  <div className="text-sm font-medium">
                    {o.user?.name ?? "—"}
                  </div>
                  <div className="text-muted-foreground font-mono text-xs">
                    {o.user?.phone ?? "—"}
                  </div>
                </TableCell>
                <TableCell className="max-w-[16rem]">
                  <OrderItemsCell
                    order={o}
                    photoByProductId={photoByProductId}
                  />
                </TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={statusBadgeClass(o.status)}
                  >
                    {o.statusLabel ?? o.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={deliveryStatusBadgeClass(
                      getDeliveryStatus(o)
                    )}
                  >
                    {formatDeliveryStatusLabel(getDeliveryStatus(o))}
                  </Badge>
                </TableCell>
                <TableCell className="max-w-[10rem]">
                  {o.deliveryPartner ? (
                    <div className="text-xs">
                      <div className="font-medium leading-tight">
                        {o.deliveryPartner.name}
                      </div>
                      <div className="text-muted-foreground font-mono">
                        {o.deliveryPartner.phone}
                      </div>
                    </div>
                  ) : (
                    <span className="text-muted-foreground text-xs">—</span>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant={o.depositEnabled === false ? "outline" : "default"}>
                    {o.depositEnabled === false ? "Disabled" : "Enabled"}
                  </Badge>
                </TableCell>
                <TableCell className="font-mono text-xs text-center">
                  {formatMoney(getDepositCharge(o))}
                </TableCell>
                <TableCell className="font-mono text-xs text-center">
                  {getReturnableCansCount(o)}
                </TableCell>
                <TableCell className="font-mono text-xs">
                  {formatMoney(getOrderTotal(o))}
                </TableCell>
                <TableCell className="text-right">
                  <OrderActions
                    order={o}
                    deliveryPartners={deliveryPartners}
                    onDone={() =>
                      queryClient.invalidateQueries({ queryKey: ["admin-orders"] })
                    }
                  />
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
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
            {(order.user?.name || order.user?.phone) ? (
              <span className="mt-1 block">
                {order.user?.name}
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
}: {
  order: OrderDto;
  deliveryPartners: DeliveryPartnerDto[];
  onDone: () => void;
}) {
  const [pending, setPending] = React.useState(false);
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

  async function go(nextStatus: string) {
    setPending(true);
    const r = await updateOrderStatusAction(order.id, nextStatus);
    setPending(false);
    if (!r.ok) {
      toast.error(r.error ?? "Status update rejected");
      return;
    }
    toast.success("Order updated");
    onDone();
  }

  async function cancel() {
    setPending(true);
    const r = await cancelOrderAction(order.id);
    setPending(false);
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
    setPending(true);
    const r = await refundReturnedCansAction(order.id, qty);
    setPending(false);
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
    setPending(true);
    const r = await assignOrderToPartnerAction(order.id, partnerId);
    setPending(false);
    if (!r.ok) {
      toast.error(r.error ?? "Assignment failed");
      return;
    }
    toast.success("Driver assigned");
    setAssignOpen(false);
    setPartnerId("");
    onDone();
  }

  if (
    status === "DELIVERED" ||
    status === "CANCELLED" ||
    isTerminalDeliveryStatus(order)
  ) {
    return <span className="text-muted-foreground text-xs">—</span>;
  }

  return (
    <div className="flex flex-wrap justify-end gap-2">
      {canAssign ? (
        <>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={pending}
            onClick={() => setAssignOpen(true)}
          >
            {hasAssignedPartner ? "Reassign driver" : "Assign driver"}
          </Button>
          <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
            <DialogContent className="sm:max-w-md" showCloseButton>
              <DialogHeader>
                <DialogTitle>Assign delivery partner</DialogTitle>
                <DialogDescription>
                  Uses the partner&apos;s DeliveryPartner id. Only partners
                  marked available are listed. Reassign only before pickup.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-2 py-2">
                <label htmlFor={`assign-${order.id}`} className="text-sm font-medium">
                  Partner
                </label>
                <select
                  id={`assign-${order.id}`}
                  className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={partnerId}
                  onChange={(e) => setPartnerId(e.target.value)}
                >
                  <option value="">Select…</option>
                  {availablePartners.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} · {p.phone}
                    </option>
                  ))}
                </select>
                {availablePartners.length === 0 ? (
                  <p className="text-muted-foreground text-xs">
                    No available drivers. Add or enable partners under Drivers.
                  </p>
                ) : null}
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setAssignOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  disabled={pending || !partnerId}
                  onClick={() => assignPartner()}
                >
                  Assign
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </>
      ) : null}
      {next && !hasAssignedPartner ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className={nextStatusButtonClass(next)}
          disabled={pending}
          onClick={() => go(next)}
        >
          → {next}
        </Button>
      ) : null}
      {canCancel ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => cancel()}
        >
          Cancel
        </Button>
      ) : null}
      {canRefund ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => refundReturnedCans()}
        >
          Refund cans
        </Button>
      ) : null}
    </div>
  );
}

function getDepositCharge(order: OrderDto): number {
  return (
    order.depositCharge ??
    order.deposit?.charge ??
    0
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
