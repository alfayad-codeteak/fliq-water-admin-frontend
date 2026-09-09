"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Minus, Plus, UserPlus } from "lucide-react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";

import {
  createCustomerAddressAction,
  createCustomerWithAddressAction,
  findCustomerByPhoneAction,
} from "@/lib/actions/customers";
import {
  createAdminOrderAction,
  quoteAdminOrderAction,
} from "@/lib/actions/orders";
import { clientFetch } from "@/lib/api/client-fetch";
import type {
  CustomerDetailDto,
  CustomerRowDto,
  OrderDto,
  ProductDto,
} from "@/lib/api/types";
import { productSalePrice } from "@/lib/products/product-price";
import {
  buildDeliveryTimeSlot,
  defaultDeliverySlotParts,
  DeliverySlotPicker,
} from "@/components/orders/delivery-slot-picker";
import { Button } from "@/components/ui/button";
import {
  RightSidebar,
  RightSidebarActions,
} from "@/components/ui/right-sidebar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const emptyNewCustomer = {
  name: "",
  phone: "",
  addressLabel: "Home",
  line1: "",
  city: "",
  state: "Kerala",
  pincode: "",
};

function normalizePhoneDigits(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, 10);
}

function formatMoney(v: unknown): string {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return "—";
  return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function formatAddressLabel(
  a: NonNullable<CustomerDetailDto["addresses"]>[number]
): string {
  const parts = [a.label, a.line1, a.line2, a.city, a.pincode].filter(Boolean);
  return parts.length ? parts.join(" · ") : a.id;
}

function productThumb(p: ProductDto): string | null {
  if (p.photoUrl) return p.photoUrl;
  const extra = p.photoUrls?.find(Boolean);
  return extra ?? null;
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

function fieldError(
  error: Record<string, string[] | undefined> | undefined,
  key: string
): string | null {
  return error?.[key]?.[0] ?? null;
}

function qtyMapToItems(qty: Record<string, number>) {
  return Object.entries(qty)
    .filter(([, n]) => n > 0)
    .map(([productId, quantity]) => ({ productId, quantity }));
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
  const [phoneInput, setPhoneInput] = React.useState("");
  const [matchedCustomer, setMatchedCustomer] =
    React.useState<CustomerRowDto | null>(null);
  const [phoneLookupStatus, setPhoneLookupStatus] = React.useState<
    "idle" | "looking" | "found" | "not_found"
  >("idle");
  const [newCustomer, setNewCustomer] = React.useState(emptyNewCustomer);
  const [creatingCustomer, setCreatingCustomer] = React.useState(false);
  const [addingAddress, setAddingAddress] = React.useState(false);
  const [customerFormError, setCustomerFormError] = React.useState<
    Record<string, string[] | undefined> | null
  >(null);
  const [slotDate, setSlotDate] = React.useState(
    () => defaultDeliverySlotParts().date
  );
  const [slotStart, setSlotStart] = React.useState(
    () => defaultDeliverySlotParts().startTime
  );
  const [slotEnd, setSlotEnd] = React.useState(
    () => defaultDeliverySlotParts().endTime
  );
  const timeSlot = buildDeliveryTimeSlot(slotDate, slotStart, slotEnd);
  const [returnedCanCount, setReturnedCanCount] = React.useState(0);
  const [qty, setQty] = React.useState<Record<string, number>>({});
  const [quote, setQuote] = React.useState<OrderDto | null>(null);
  const [quoting, setQuoting] = React.useState(false);
  const [creating, setCreating] = React.useState(false);
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  const activeProducts = products.filter((p) => p.isActive !== false);
  const phoneDigits = normalizePhoneDigits(phoneInput);
  const cartItems = React.useMemo(() => qtyMapToItems(qty), [qty]);
  const cartCount = cartItems.reduce((s, i) => s + i.quantity, 0);
  const canQuantity = React.useMemo(() => {
    const byId = new Map(activeProducts.map((p) => [p.id, p]));
    return cartItems.reduce((sum, line) => {
      const product = byId.get(line.productId);
      if (!product || product.hasDeposit === false) return sum;
      return sum + line.quantity;
    }, 0);
  }, [activeProducts, cartItems]);
  const normalizedReturned = Math.max(0, Math.min(returnedCanCount, canQuantity));
  const ifCanRefund = canQuantity > 0 && normalizedReturned > 0;

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
      setPhoneInput("");
      setMatchedCustomer(null);
      setPhoneLookupStatus("idle");
      setNewCustomer(emptyNewCustomer);
      setCreatingCustomer(false);
      setAddingAddress(false);
      setCustomerFormError(null);
      const defaults = defaultDeliverySlotParts();
      setSlotDate(defaults.date);
      setSlotStart(defaults.startTime);
      setSlotEnd(defaults.endTime);
      setReturnedCanCount(0);
      setQty({});
      setQuote(null);
      setConfirmOpen(false);
    }
  }, [open]);

  React.useEffect(() => {
    setAddressId("");
    setQuote(null);
  }, [userId]);

  React.useEffect(() => {
    if (!userId || loadingAddresses || !addresses.length) return;
    setAddressId((current) => {
      if (current && addresses.some((a) => a.id === current)) return current;
      const preferred = addresses.find((a) => a.isDefault) ?? addresses[0];
      return preferred?.id ?? "";
    });
  }, [userId, loadingAddresses, addresses]);

  React.useEffect(() => {
    setReturnedCanCount((n) => Math.min(n, canQuantity));
  }, [canQuantity]);

  React.useEffect(() => {
    if (!open) return;

    if (phoneDigits.length !== 10) {
      setPhoneLookupStatus("idle");
      setMatchedCustomer(null);
      setUserId("");
      setCustomerFormError(null);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setPhoneLookupStatus("looking");
      setCustomerFormError(null);
      const res = await findCustomerByPhoneAction(phoneDigits);
      if (cancelled) return;

      if (!res.ok) {
        setPhoneLookupStatus("idle");
        setMatchedCustomer(null);
        setUserId("");
        toast.error(res.error);
        return;
      }

      if (res.customer) {
        setMatchedCustomer(res.customer);
        setUserId(res.customer.id);
        setPhoneLookupStatus("found");
        setNewCustomer((prev) => ({
          ...emptyNewCustomer,
          phone: phoneDigits,
          name: res.customer?.name ?? prev.name,
        }));
      } else {
        setMatchedCustomer(null);
        setUserId("");
        setPhoneLookupStatus("not_found");
        setNewCustomer((prev) => ({
          ...emptyNewCustomer,
          phone: phoneDigits,
          name: prev.name,
          addressLabel: prev.addressLabel || "Home",
          line1: prev.line1,
          city: prev.city,
          state: prev.state || "Kerala",
          pincode: prev.pincode,
        }));
      }
    }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [open, phoneDigits]);

  function updateNewCustomer(patch: Partial<typeof emptyNewCustomer>) {
    setNewCustomer((prev) => ({ ...prev, ...patch }));
    setCustomerFormError(null);
  }

  function setProductQty(productId: string, next: number, stock: number) {
    const clamped = Math.max(0, Math.min(stock, next));
    setQty((prev) => {
      const copy = { ...prev };
      if (clamped <= 0) delete copy[productId];
      else copy[productId] = clamped;
      return copy;
    });
    setQuote(null);
  }

  async function runCreateCustomer() {
    if (phoneDigits.length !== 10) {
      toast.error("Enter a valid 10-digit phone");
      return;
    }

    setCreatingCustomer(true);
    setCustomerFormError(null);

    const res = await createCustomerWithAddressAction({
      phone: phoneDigits,
      name: newCustomer.name.trim() || undefined,
      address: {
        label: newCustomer.addressLabel || "Home",
        line1: newCustomer.line1,
        city: newCustomer.city,
        state: newCustomer.state,
        pincode: newCustomer.pincode,
        isDefault: true,
      },
    });

    setCreatingCustomer(false);

    if (!res.ok) {
      setCustomerFormError(res.error);
      const rootMsg = fieldError(res.error, "root");
      if ("partial" in res && res.partial?.customer) {
        setMatchedCustomer(res.partial.customer);
        setUserId(res.partial.customer.id);
        setPhoneLookupStatus("found");
        await queryClient.invalidateQueries({
          queryKey: ["admin-customer-detail", res.partial.customer.id],
        });
        toast.error(
          rootMsg ??
            "Customer was created but address failed. Add an address below."
        );
      } else {
        toast.error(rootMsg ?? "Could not create customer");
      }
      return;
    }

    await queryClient.invalidateQueries({
      queryKey: ["admin-customer-detail", res.data.customer.id],
    });

    setMatchedCustomer(res.data.customer);
    setUserId(res.data.customer.id);
    setAddressId(res.data.address.id);
    setPhoneLookupStatus("found");
    setQuote(null);
    toast.success("Customer saved");
  }

  async function runAddAddress() {
    if (!userId) {
      toast.error("Find the customer first");
      return;
    }

    setAddingAddress(true);
    setCustomerFormError(null);

    const res = await createCustomerAddressAction(userId, {
      label: newCustomer.addressLabel || "Home",
      line1: newCustomer.line1,
      city: newCustomer.city,
      state: newCustomer.state,
      pincode: newCustomer.pincode,
      isDefault: addresses.length === 0,
    });

    setAddingAddress(false);

    if (!res.ok) {
      setCustomerFormError(res.error);
      toast.error(fieldError(res.error, "root") ?? "Could not add address");
      return;
    }

    await queryClient.invalidateQueries({
      queryKey: ["admin-customer-detail", userId],
    });
    setAddressId(res.data.id);
    setQuote(null);
    toast.success("Address added");
  }

  function buildPayload() {
    return {
      userId,
      addressId,
      timeSlot: timeSlot.trim(),
      paymentMethod: "COD",
      items: cartItems,
      ifCanRefund,
      returnedCanCount: ifCanRefund ? normalizedReturned : 0,
    };
  }

  React.useEffect(() => {
    if (!open || !userId || !addressId || cartItems.length === 0) {
      return;
    }
    if (!slotDate || !slotStart || !slotEnd || slotStart >= slotEnd) return;

    const payload = {
      userId,
      addressId,
      timeSlot: timeSlot.trim(),
      paymentMethod: "COD",
      items: cartItems,
      ifCanRefund,
      returnedCanCount: ifCanRefund ? normalizedReturned : 0,
    };

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setQuoting(true);
      const res = await quoteAdminOrderAction(payload);
      if (cancelled) return;
      setQuoting(false);
      if (!res.ok) {
        setQuote(null);
        return;
      }
      setQuote(res.data);
    }, 400);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      setQuoting(false);
    };
  }, [
    open,
    userId,
    addressId,
    timeSlot,
    slotDate,
    slotStart,
    slotEnd,
    ifCanRefund,
    returnedCanCount,
    cartItems,
  ]);

  async function runCreate() {
    if (!userId || !addressId) {
      toast.error("Pick a customer and address");
      return;
    }
    if (!slotDate || !slotStart || !slotEnd) {
      toast.error("Pick a delivery slot");
      return;
    }
    if (slotStart >= slotEnd) {
      toast.error("End time must be after start time");
      return;
    }
    if (cartItems.length === 0) {
      toast.error("Add at least one product");
      return;
    }

    setCreating(true);
    const res = await createAdminOrderAction(buildPayload());
    setCreating(false);
    if (!res.ok) {
      toast.error(firstRootError(res.error) ?? "Create failed");
      setConfirmOpen(false);
      return;
    }
    toast.success(
      `Order placed${res.data.orderNumber ? ` · #${res.data.orderNumber}` : ""}`
    );
    setConfirmOpen(false);
    onOpenChange(false);
    queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
  }

  const selectedAddress = addresses.find((a) => a.id === addressId);
  const displayTotal =
    quote?.totalAmount ?? quote?.total ?? quote?.amount ?? null;
  const canPlace =
    Boolean(userId && addressId && cartItems.length > 0 && slotDate && slotStart && slotEnd);

  const addressForm = (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="grid gap-1.5 sm:col-span-2">
        <Label htmlFor="nc-line1">House / street</Label>
        <Input
          id="nc-line1"
          value={newCustomer.line1}
          onChange={(e) => updateNewCustomer({ line1: e.target.value })}
          placeholder="Flat, building, street"
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="nc-city">City</Label>
        <Input
          id="nc-city"
          value={newCustomer.city}
          onChange={(e) => updateNewCustomer({ city: e.target.value })}
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="nc-pincode">Pincode</Label>
        <Input
          id="nc-pincode"
          value={newCustomer.pincode}
          onChange={(e) => updateNewCustomer({ pincode: e.target.value })}
        />
      </div>
    </div>
  );

  return (
    <RightSidebar
      open={open}
      onOpenChange={onOpenChange}
      title="Create order"
      description="Same flow as the customer app: pick products, address, slot, then place COD."
      size="order"
      bodyClassName="px-5 py-4 lg:px-6"
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.9fr)] lg:items-start">
        <section className="space-y-3">
          <div className="flex items-end justify-between gap-2">
            <div>
              <p className="text-[11px] font-bold tracking-[0.12em] text-slate-400 uppercase">
                Products
              </p>
              <p className="text-sm font-bold text-slate-800">
                {cartCount === 0
                  ? "Tap + to add cans"
                  : `${cartCount} item${cartCount === 1 ? "" : "s"} in order`}
              </p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {activeProducts.map((p) => {
              const n = qty[p.id] ?? 0;
              const price = productSalePrice(p);
              const thumb = productThumb(p);
              const out = (p.stock ?? 0) <= 0;
              return (
                <div
                  key={p.id}
                  className={cn(
                    "flex gap-3 rounded-2xl border bg-white p-3 shadow-sm",
                    n > 0 ? "border-sky-400 ring-1 ring-sky-200" : "border-slate-200",
                    out && "opacity-50"
                  )}
                >
                  <div className="size-14 shrink-0 overflow-hidden rounded-xl bg-slate-100">
                    {thumb ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={thumb}
                        alt=""
                        className="size-full object-cover"
                      />
                    ) : (
                      <div className="flex size-full items-center justify-center text-[10px] font-bold text-slate-400">
                        NB
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-extrabold text-slate-900">
                      {p.name}
                    </p>
                    <p className="text-xs font-semibold text-slate-500">
                      ₹{price} · {out ? "Out of stock" : `${p.stock} in stock`}
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      {n === 0 ? (
                        <Button
                          type="button"
                          size="sm"
                          className="h-8 rounded-full px-3"
                          disabled={out}
                          onClick={() => setProductQty(p.id, 1, p.stock)}
                        >
                          Add
                        </Button>
                      ) : (
                        <div className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50">
                          <button
                            type="button"
                            className="flex size-8 items-center justify-center"
                            aria-label={`Remove one ${p.name}`}
                            onClick={() => setProductQty(p.id, n - 1, p.stock)}
                          >
                            <Minus className="size-3.5" />
                          </button>
                          <span className="min-w-6 text-center text-sm font-extrabold tabular-nums">
                            {n}
                          </span>
                          <button
                            type="button"
                            className="flex size-8 items-center justify-center"
                            aria-label={`Add one ${p.name}`}
                            disabled={n >= p.stock}
                            onClick={() => setProductQty(p.id, n + 1, p.stock)}
                          >
                            <Plus className="size-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="space-y-4 lg:sticky lg:top-0">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-[11px] font-bold tracking-[0.12em] text-slate-400 uppercase">
              1 · Customer
            </p>
            <Label htmlFor="co-phone" className="mt-2">
              Phone
            </Label>
            <Input
              id="co-phone"
              type="tel"
              inputMode="numeric"
              maxLength={10}
              value={phoneInput}
              onChange={(e) =>
                setPhoneInput(normalizePhoneDigits(e.target.value))
              }
              placeholder="10-digit mobile"
              autoComplete="tel"
              className="mt-1.5 h-11 text-base"
            />
            <p className="text-muted-foreground mt-1.5 text-xs">
              {phoneLookupStatus === "looking"
                ? "Looking up…"
                : phoneDigits.length < 10
                  ? "Type the number — we find or create the customer."
                  : null}
            </p>

            {phoneLookupStatus === "found" && matchedCustomer ? (
              <div className="mt-3 rounded-xl bg-sky-50 px-3 py-2">
                <p className="text-sm font-extrabold text-slate-900">
                  {matchedCustomer.name?.trim() || "Customer"}
                </p>
                <p className="font-mono text-xs font-semibold text-slate-500">
                  {matchedCustomer.phone}
                </p>
              </div>
            ) : null}

            {phoneLookupStatus === "not_found" ? (
              <div className="mt-3 space-y-3">
                <p className="text-sm font-bold">New customer</p>
                {fieldError(customerFormError ?? undefined, "root") ? (
                  <p className="text-destructive text-xs" role="alert">
                    {fieldError(customerFormError ?? undefined, "root")}
                  </p>
                ) : null}
                <div className="grid gap-1.5">
                  <Label htmlFor="nc-name">Name</Label>
                  <Input
                    id="nc-name"
                    value={newCustomer.name}
                    onChange={(e) =>
                      updateNewCustomer({ name: e.target.value })
                    }
                    placeholder="Optional"
                  />
                </div>
                {addressForm}
                <Button
                  type="button"
                  className="w-full"
                  loading={creatingCustomer}
                  loadingText="Saving…"
                  disabled={creatingCustomer}
                  onClick={() => void runCreateCustomer()}
                >
                  <UserPlus className="mr-2 size-4" />
                  Save customer
                </Button>
              </div>
            ) : null}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-[11px] font-bold tracking-[0.12em] text-slate-400 uppercase">
              2 · Address
            </p>
            {!userId ? (
              <p className="mt-2 text-sm text-slate-500">
                Enter phone first.
              </p>
            ) : loadingAddresses ? (
              <p className="mt-2 text-sm text-slate-500">Loading addresses…</p>
            ) : addresses.length > 0 ? (
              <div className="mt-2 grid gap-2">
                {addresses.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => {
                      setAddressId(a.id);
                      setQuote(null);
                    }}
                    className={cn(
                      "rounded-xl border px-3 py-2.5 text-left text-sm",
                      addressId === a.id
                        ? "border-sky-500 bg-sky-50 font-bold"
                        : "border-slate-200 bg-white font-semibold text-slate-700"
                    )}
                  >
                    {formatAddressLabel(a)}
                  </button>
                ))}
              </div>
            ) : (
              <div className="mt-2 space-y-3">
                <p className="text-sm text-slate-500">No saved address. Add one.</p>
                {addressForm}
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full"
                  loading={addingAddress}
                  loadingText="Adding…"
                  disabled={addingAddress}
                  onClick={() => void runAddAddress()}
                >
                  Add address
                </Button>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="mb-3 text-[11px] font-bold tracking-[0.12em] text-slate-400 uppercase">
              3 · Delivery
            </p>
            <DeliverySlotPicker
              date={slotDate}
              startTime={slotStart}
              endTime={slotEnd}
              onChange={({ date, startTime, endTime }) => {
                setSlotDate(date);
                setSlotStart(startTime);
                setSlotEnd(endTime);
                setQuote(null);
              }}
            />
            <p className="mt-3 text-xs font-semibold text-slate-500">
              Payment · Cash on delivery
            </p>
            {canQuantity > 0 ? (
              <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                <p className="text-sm font-extrabold text-slate-900">Can return</p>
                <p className="mt-1 text-xs font-semibold leading-relaxed text-slate-500">
                  Ordering {canQuantity} refill can{canQuantity !== 1 ? "s" : ""}.
                  How many empty 20L cans will they hand back? Up to {canQuantity}{" "}
                  — same as the can quantity. Returning cans reduces deposit.
                </p>
                <div className="mt-3 flex items-center justify-center gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="size-11 rounded-full"
                    aria-label="Fewer returned cans"
                    disabled={normalizedReturned <= 0}
                    onClick={() => {
                      setReturnedCanCount((n) => Math.max(0, n - 1));
                      setQuote(null);
                    }}
                  >
                    <Minus className="size-4" />
                  </Button>
                  <div className="min-w-20 text-center">
                    <p className="text-3xl leading-none font-extrabold tabular-nums">
                      {normalizedReturned}
                    </p>
                    <p className="mt-1 text-[11px] font-bold tracking-wide text-slate-400 uppercase">
                      returned
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="size-11 rounded-full"
                    aria-label="More returned cans"
                    disabled={normalizedReturned >= canQuantity}
                    onClick={() => {
                      setReturnedCanCount((n) => Math.min(canQuantity, n + 1));
                      setQuote(null);
                    }}
                  >
                    <Plus className="size-4" />
                  </Button>
                </div>
                <button
                  type="button"
                  className="mt-3 w-full text-center text-xs font-bold text-slate-500 underline-offset-2 hover:underline"
                  onClick={() => {
                    setReturnedCanCount(0);
                    setQuote(null);
                  }}
                >
                  No empty cans
                </button>
              </div>
            ) : null}
          </div>
        </section>
      </div>

      <RightSidebarActions className="flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[11px] font-bold tracking-wide text-slate-400 uppercase">
            {quoting ? "Updating total…" : "To pay (COD)"}
          </p>
          <p className="text-2xl font-extrabold tabular-nums tracking-tight">
            {displayTotal == null ? "—" : formatMoney(displayTotal)}
          </p>
          {quote?.depositCharge != null ? (
            <p className="text-xs font-semibold text-slate-500">
              Deposit {formatMoney(quote.depositCharge)}
              {Number(quote.depositDiscount) > 0
                ? ` · savings ${formatMoney(quote.depositDiscount)}`
                : ""}
              {normalizedReturned > 0
                ? ` · ${normalizedReturned} empty can${normalizedReturned === 1 ? "" : "s"} back`
                : ""}
            </p>
          ) : null}
        </div>
        <Button
          type="button"
          size="lg"
          className="h-12 min-w-44 rounded-xl text-base font-extrabold"
          disabled={!canPlace || quoting || creating}
          onClick={() => setConfirmOpen(true)}
        >
          Place order
        </Button>
      </RightSidebarActions>

      {confirmOpen ? (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-black/45 p-4 sm:items-center"
          role="presentation"
          onClick={() => {
            if (!creating) setConfirmOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-extrabold">Place this order?</h2>
            <p className="mt-2 text-sm font-semibold text-slate-600">
              {cartCount} item{cartCount === 1 ? "" : "s"} for{" "}
              {matchedCustomer?.name || matchedCustomer?.phone || "customer"}
              {selectedAddress
                ? ` · ${formatAddressLabel(selectedAddress)}`
                : ""}
              . COD {displayTotal == null ? "" : `· ${formatMoney(displayTotal)}`}.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-11"
                disabled={creating}
                onClick={() => setConfirmOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="h-11"
                loading={creating}
                loadingText="Placing…"
                disabled={creating}
                onClick={() => void runCreate()}
              >
                Yes, place order
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </RightSidebar>
  );
}
