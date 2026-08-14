"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Calculator, Plus, Trash2, UserPlus } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";

type LineItem = { productId: string; quantity: string };

const emptyNewCustomer = {
  name: "",
  phone: "",
  password: "",
  addressLabel: "Home",
  line1: "",
  city: "",
  state: "",
  pincode: "",
};

function normalizePhoneDigits(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, 10);
}

function formatMoney(v: unknown): string {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return "—";
  return `₹${n.toFixed(2)}`;
}

function formatAddressLabel(
  a: NonNullable<CustomerDetailDto["addresses"]>[number]
): string {
  const parts = [a.label, a.line1, a.city, a.state, a.pincode].filter(Boolean);
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

function fieldError(
  error: Record<string, string[] | undefined> | undefined,
  key: string
): string | null {
  const msg = error?.[key]?.[0];
  return msg ?? null;
}

function addressFieldError(
  error: Record<string, string[] | undefined> | undefined,
  key: string
): string | null {
  return (
    fieldError(error, `address.${key}`) ??
    fieldError(error, key) ??
    null
  );
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
  const phoneDigits = normalizePhoneDigits(phoneInput);

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
          state: prev.state,
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
      password: newCustomer.password.trim() || undefined,
      address: {
        label: newCustomer.addressLabel,
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
    toast.success("Customer created");
  }

  async function runAddAddress() {
    if (!userId) {
      toast.error("Select a customer first");
      return;
    }

    setAddingAddress(true);
    setCustomerFormError(null);

    const res = await createCustomerAddressAction(userId, {
      label: newCustomer.addressLabel,
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
    if (!slotDate || !slotStart || !slotEnd) {
      toast.error("Pick a delivery date and time range");
      return;
    }
    if (slotStart >= slotEnd) {
      toast.error("End time must be after start time");
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
    if (!slotDate || !slotStart || !slotEnd) {
      toast.error("Pick a delivery date and time range");
      return;
    }
    if (slotStart >= slotEnd) {
      toast.error("End time must be after start time");
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
    <RightSidebar
      open={open}
      onOpenChange={onOpenChange}
      title="Create order"
      description="Place an order on behalf of a customer. Use quote to preview totals before saving."
      size="lg"
    >
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="co-phone">Customer phone</Label>
            <Input
              id="co-phone"
              type="tel"
              inputMode="numeric"
              maxLength={10}
              value={phoneInput}
              onChange={(e) =>
                setPhoneInput(normalizePhoneDigits(e.target.value))
              }
              placeholder="10-digit mobile number"
              autoComplete="tel"
            />
            <p className="text-muted-foreground text-xs">
              {phoneLookupStatus === "looking"
                ? "Looking up customer…"
                : phoneDigits.length < 10
                  ? "Enter 10 digits to find or create a customer."
                  : null}
            </p>

            {phoneLookupStatus === "found" && matchedCustomer ? (
              <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
                <p className="font-medium">
                  {matchedCustomer.name?.trim() || "Customer found"}
                </p>
                <p className="text-muted-foreground font-mono text-xs">
                  {matchedCustomer.phone}
                </p>
              </div>
            ) : null}

            {phoneLookupStatus === "not_found" ? (
              <div className="space-y-3 rounded-md border p-3">
                <p className="text-sm font-medium">No customer with this phone</p>
                <p className="text-muted-foreground text-xs">
                  Create a customer with {phoneDigits} and a delivery address.
                </p>

                {fieldError(customerFormError ?? undefined, "root") ? (
                  <p
                    className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
                    role="alert"
                  >
                    {fieldError(customerFormError ?? undefined, "root")}
                  </p>
                ) : null}

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="grid gap-1.5 sm:col-span-2">
                    <Label htmlFor="nc-name">Name (optional)</Label>
                    <Input
                      id="nc-name"
                      value={newCustomer.name}
                      onChange={(e) =>
                        updateNewCustomer({ name: e.target.value })
                      }
                      placeholder="Customer name"
                    />
                    {fieldError(customerFormError ?? undefined, "name") ? (
                      <p className="text-destructive text-xs">
                        {fieldError(customerFormError ?? undefined, "name")}
                      </p>
                    ) : null}
                  </div>
                  <div className="grid gap-1.5 sm:col-span-2">
                    <Label htmlFor="nc-password">Password (optional)</Label>
                    <Input
                      id="nc-password"
                      type="password"
                      autoComplete="new-password"
                      value={newCustomer.password}
                      onChange={(e) =>
                        updateNewCustomer({ password: e.target.value })
                      }
                      placeholder="Leave blank for OTP-only login"
                    />
                  </div>
                </div>

                <div className="space-y-3 border-t pt-3">
                  <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                    Delivery address
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="grid gap-1.5">
                      <Label htmlFor="nc-label">Label</Label>
                      <Input
                        id="nc-label"
                        value={newCustomer.addressLabel}
                        onChange={(e) =>
                          updateNewCustomer({ addressLabel: e.target.value })
                        }
                        placeholder="Home"
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <Label htmlFor="nc-city">City</Label>
                      <Input
                        id="nc-city"
                        value={newCustomer.city}
                        onChange={(e) =>
                          updateNewCustomer({ city: e.target.value })
                        }
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <Label htmlFor="nc-state">State</Label>
                      <Input
                        id="nc-state"
                        value={newCustomer.state}
                        onChange={(e) =>
                          updateNewCustomer({ state: e.target.value })
                        }
                        placeholder="Maharashtra"
                      />
                    </div>
                    <div className="grid gap-1.5 sm:col-span-2">
                      <Label htmlFor="nc-line1">Address line</Label>
                      <Input
                        id="nc-line1"
                        value={newCustomer.line1}
                        onChange={(e) =>
                          updateNewCustomer({ line1: e.target.value })
                        }
                        placeholder="House / street"
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <Label htmlFor="nc-pincode">Pincode</Label>
                      <Input
                        id="nc-pincode"
                        value={newCustomer.pincode}
                        onChange={(e) =>
                          updateNewCustomer({ pincode: e.target.value })
                        }
                      />
                    </div>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="secondary"
                  className="w-full"
                  loading={creatingCustomer}
                  loadingText="Creating…"
                  disabled={creatingCustomer}
                  onClick={() => runCreateCustomer()}
                >
                  <UserPlus className="mr-2 size-4" />
                  Create customer with this phone
                </Button>
              </div>
            ) : null}
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
                    ? "Enter customer phone first"
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

            {userId && !loadingAddresses && addresses.length === 0 ? (
              <div className="space-y-3 rounded-md border border-dashed p-3">
                <p className="text-muted-foreground text-xs">
                  This customer has no delivery address yet. Add one to continue.
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="grid gap-1.5">
                    <Label htmlFor="aa-label">Label</Label>
                    <Input
                      id="aa-label"
                      value={newCustomer.addressLabel}
                      onChange={(e) =>
                        updateNewCustomer({ addressLabel: e.target.value })
                      }
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="aa-city">City</Label>
                    <Input
                      id="aa-city"
                      value={newCustomer.city}
                      onChange={(e) =>
                        updateNewCustomer({ city: e.target.value })
                      }
                    />
                  </div>
                  <div className="grid gap-1.5 sm:col-span-2">
                    <Label htmlFor="aa-line1">Address line</Label>
                    <Input
                      id="aa-line1"
                      value={newCustomer.line1}
                      onChange={(e) =>
                        updateNewCustomer({ line1: e.target.value })
                      }
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="aa-state">State</Label>
                    <Input
                      id="aa-state"
                      value={newCustomer.state}
                      onChange={(e) =>
                        updateNewCustomer({ state: e.target.value })
                      }
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="aa-pincode">Pincode</Label>
                    <Input
                      id="aa-pincode"
                      value={newCustomer.pincode}
                      onChange={(e) =>
                        updateNewCustomer({ pincode: e.target.value })
                      }
                    />
                  </div>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  loading={addingAddress}
                  loadingText="Adding…"
                  disabled={addingAddress}
                  onClick={() => runAddAddress()}
                >
                  Add address
                </Button>
              </div>
            ) : null}
          </div>

          <div className="grid gap-4">
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
                          {p.name} · ₹{productSalePrice(p)} · stock {p.stock}
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

        <RightSidebarActions className="flex-col gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="secondary"
            loading={quoting}
            loadingText="Quoting…"
            disabled={quoting || creating}
            onClick={() => runQuote()}
          >
            <Calculator className="mr-2 size-4" />
            Get quote
          </Button>
          <Button
            type="button"
            loading={creating}
            loadingText="Creating…"
            disabled={quoting || creating}
            onClick={() => runCreate()}
          >
            Create order
          </Button>
        </RightSidebarActions>
    </RightSidebar>
  );
}
