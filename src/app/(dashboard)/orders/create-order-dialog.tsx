"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Calculator, Plus, Trash2 } from "lucide-react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";

import {
  createAdminOrderAction,
  quoteAdminOrderAction,
} from "@/lib/actions/orders";
import { clientFetch } from "@/lib/api/client-fetch";
import type {
  CustomerDetailDto,
  CustomerRowDto,
  OrderDto,
  PaginatedCustomersDto,
  ProductDto,
} from "@/lib/api/types";
import { Button } from "@/components/ui/button";
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
import { Switch } from "@/components/ui/switch";

type LineItem = { productId: string; quantity: string };

function formatMoney(v: unknown): string {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return "—";
  return `₹${n.toFixed(2)}`;
}

function formatAddressLabel(
  a: NonNullable<CustomerDetailDto["addresses"]>[number]
): string {
  const parts = [a.label, a.line1, a.city, a.pincode].filter(Boolean);
  return parts.length ? parts.join(" · ") : a.id;
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

function buildPayload(
  userId: string,
  addressId: string,
  timeSlot: string,
  paymentMethod: string,
  items: LineItem[],
  ifCanRefund: boolean,
  returnedCanCount: string
) {
  return {
    userId,
    addressId,
    timeSlot: timeSlot.trim(),
    paymentMethod,
    items: items
      .filter((i) => i.productId && Number(i.quantity) > 0)
      .map((i) => ({
        productId: i.productId,
        quantity: Number.parseInt(i.quantity, 10),
      })),
    ifCanRefund,
    returnedCanCount: ifCanRefund
      ? Number.parseInt(returnedCanCount || "0", 10)
      : 0,
  };
}

export function CreateOrderDialog({
  open,
  onOpenChange,
  products,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: ProductDto[];
}) {
  const queryClient = useQueryClient();
  const { status } = useSession();

  const [userId, setUserId] = React.useState("");
  const [addressId, setAddressId] = React.useState("");
  const [timeSlot, setTimeSlot] = React.useState("10:00-12:00");
  const [paymentMethod, setPaymentMethod] = React.useState("COD");
  const [ifCanRefund, setIfCanRefund] = React.useState(false);
  const [returnedCanCount, setReturnedCanCount] = React.useState("0");
  const [items, setItems] = React.useState<LineItem[]>([
    { productId: "", quantity: "1" },
  ]);
  const [quote, setQuote] = React.useState<OrderDto | null>(null);
  const [quoting, setQuoting] = React.useState(false);
  const [creating, setCreating] = React.useState(false);

  const activeProducts = products.filter((p) => p.isActive !== false);

  const { data: customers = [] } = useQuery({
    queryKey: ["admin-customers-create-order"],
    queryFn: async () => {
      const res = await clientFetch("/api/bff/admin/customers?page=1&limit=200");
      if (!res.ok) throw new Error("Failed to load customers");
      const body = (await res.json()) as PaginatedCustomersDto;
      return body.data ?? [];
    },
    enabled: status === "authenticated" && open,
    staleTime: 60_000,
  });

  const { data: customerDetail, isFetching: loadingAddresses } = useQuery({
    queryKey: ["admin-customer-detail", userId],
    queryFn: async () => {
      const res = await clientFetch(`/api/bff/admin/customers/${userId}`);
      if (!res.ok) throw new Error("Failed to load customer");
      return res.json() as Promise<CustomerDetailDto>;
    },
    enabled: status === "authenticated" && open && Boolean(userId),
  });

  const addresses = customerDetail?.addresses ?? [];

  React.useEffect(() => {
    if (!open) {
      setUserId("");
      setAddressId("");
      setTimeSlot("10:00-12:00");
      setPaymentMethod("COD");
      setIfCanRefund(false);
      setReturnedCanCount("0");
      setItems([{ productId: "", quantity: "1" }]);
      setQuote(null);
    }
  }, [open]);

  React.useEffect(() => {
    setAddressId("");
    setQuote(null);
  }, [userId]);

  function updateItem(index: number, patch: Partial<LineItem>) {
    setItems((prev) =>
      prev.map((row, i) => (i === index ? { ...row, ...patch } : row))
    );
    setQuote(null);
  }

  async function runQuote() {
    if (!userId || !addressId) {
      toast.error("Select customer and address");
      return;
    }
    const payload = buildPayload(
      userId,
      addressId,
      timeSlot,
      paymentMethod,
      items,
      ifCanRefund,
      returnedCanCount
    );
    if (payload.items.length === 0) {
      toast.error("Add at least one product line");
      return;
    }

    setQuoting(true);
    const res = await quoteAdminOrderAction(payload);
    setQuoting(false);
    if (!res.ok) {
      toast.error(firstRootError(res.error) ?? "Quote failed");
      return;
    }
    setQuote(res.data);
    toast.success("Quote ready");
  }

  async function runCreate() {
    if (!userId || !addressId) {
      toast.error("Select customer and address");
      return;
    }
    const payload = buildPayload(
      userId,
      addressId,
      timeSlot,
      paymentMethod,
      items,
      ifCanRefund,
      returnedCanCount
    );
    if (payload.items.length === 0) {
      toast.error("Add at least one product line");
      return;
    }

    setCreating(true);
    const res = await createAdminOrderAction(payload);
    setCreating(false);
    if (!res.ok) {
      toast.error(firstRootError(res.error) ?? "Create failed");
      return;
    }
    toast.success(`Order created${res.data.id ? ` (${res.data.id.slice(0, 8)}…)` : ""}`);
    onOpenChange(false);
    queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create order</DialogTitle>
          <DialogDescription>
            Place an order on behalf of a customer. Use quote to preview totals
            before saving.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="co-customer">Customer</Label>
            <select
              id="co-customer"
              className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
            >
              <option value="">Select customer…</option>
              {customers.map((c: CustomerRowDto) => (
                <option key={c.id} value={c.id}>
                  {c.name} · {c.phone}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="co-address">Delivery address</Label>
            <select
              id="co-address"
              className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
              value={addressId}
              disabled={!userId || loadingAddresses}
              onChange={(e) => {
                setAddressId(e.target.value);
                setQuote(null);
              }}
            >
              <option value="">
                {loadingAddresses
                  ? "Loading addresses…"
                  : !userId
                    ? "Select customer first"
                    : addresses.length === 0
                      ? "No addresses for this customer"
                      : "Select address…"}
              </option>
              {addresses.map((a) => (
                <option key={a.id} value={a.id}>
                  {formatAddressLabel(a)}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="co-slot">Time slot</Label>
              <Input
                id="co-slot"
                value={timeSlot}
                onChange={(e) => {
                  setTimeSlot(e.target.value);
                  setQuote(null);
                }}
                placeholder="10:00-12:00"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="co-pay">Payment</Label>
              <select
                id="co-pay"
                className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={paymentMethod}
                onChange={(e) => {
                  setPaymentMethod(e.target.value);
                  setQuote(null);
                }}
              >
                <option value="COD">COD</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-md border p-3">
            <div className="grid gap-0.5">
              <Label htmlFor="co-refund">Can return empty cans</Label>
              <p className="text-muted-foreground text-xs">
                Enables returned-can deposit adjustment on this order.
              </p>
            </div>
            <Switch
              id="co-refund"
              checked={ifCanRefund}
              onCheckedChange={(v) => {
                setIfCanRefund(v);
                setQuote(null);
              }}
            />
          </div>

          {ifCanRefund ? (
            <div className="grid gap-2">
              <Label htmlFor="co-returned">Returned can count</Label>
              <Input
                id="co-returned"
                type="number"
                min={0}
                step={1}
                value={returnedCanCount}
                onChange={(e) => {
                  setReturnedCanCount(e.target.value);
                  setQuote(null);
                }}
              />
            </div>
          ) : null}

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label>Items</Label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  setItems((prev) => [...prev, { productId: "", quantity: "1" }])
                }
              >
                <Plus className="mr-1 size-4" />
                Add line
              </Button>
            </div>
            <ul className="space-y-2">
              {items.map((row, idx) => (
                <li
                  key={`line-${idx}`}
                  className="flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-end"
                >
                  <div className="grid min-w-0 flex-1 gap-1.5">
                    <Label className="text-xs" htmlFor={`co-prod-${idx}`}>
                      Product
                    </Label>
                    <select
                      id={`co-prod-${idx}`}
                      className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                      value={row.productId}
                      onChange={(e) =>
                        updateItem(idx, { productId: e.target.value })
                      }
                    >
                      <option value="">Select product…</option>
                      {activeProducts.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} · ₹{p.price} · stock {p.stock}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid w-full gap-1.5 sm:w-24">
                    <Label className="text-xs" htmlFor={`co-qty-${idx}`}>
                      Qty
                    </Label>
                    <Input
                      id={`co-qty-${idx}`}
                      type="number"
                      min={1}
                      step={1}
                      value={row.quantity}
                      onChange={(e) =>
                        updateItem(idx, { quantity: e.target.value })
                      }
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="shrink-0 self-end"
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
          </div>

          {quote ? (
            <div className="rounded-md border bg-muted/40 p-3 text-sm">
              <p className="mb-2 font-medium">Quote preview</p>
              <dl className="grid gap-1 text-xs sm:grid-cols-2">
                <div className="flex justify-between gap-2 sm:block">
                  <dt className="text-muted-foreground">Subtotal / total</dt>
                  <dd className="font-mono tabular-nums">
                    {formatMoney(
                      quote.totalAmount ?? quote.total ?? quote.amount
                    )}
                  </dd>
                </div>
                <div className="flex justify-between gap-2 sm:block">
                  <dt className="text-muted-foreground">Deposit</dt>
                  <dd className="font-mono tabular-nums">
                    {formatMoney(quote.depositCharge ?? quote.deposit?.charge)}
                  </dd>
                </div>
                {quote.returnedCanCount != null ? (
                  <div className="flex justify-between gap-2 sm:block">
                    <dt className="text-muted-foreground">Returned cans</dt>
                    <dd className="font-mono tabular-nums">
                      {quote.returnedCanCount}
                    </dd>
                  </div>
                ) : null}
              </dl>
            </div>
          ) : null}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="secondary"
            disabled={quoting || creating}
            onClick={() => runQuote()}
          >
            <Calculator className="mr-2 size-4" />
            {quoting ? "Quoting…" : "Get quote"}
          </Button>
          <Button
            type="button"
            disabled={quoting || creating}
            onClick={() => runCreate()}
          >
            {creating ? "Creating…" : "Create order"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
