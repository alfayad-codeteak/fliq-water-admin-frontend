"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  Package,
  Search,
  ShoppingCart,
  Users,
} from "lucide-react";
import { useSession } from "next-auth/react";

import { clientFetch } from "@/lib/api/client-fetch";
import type {
  CustomerRowDto,
  OrderDto,
  PaginatedCustomersDto,
  ProductDto,
} from "@/lib/api/types";
import { productSalePrice } from "@/lib/products/product-price";
import { useUiStore } from "@/stores/ui-store";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

type SearchScope = "all" | "customers" | "orders" | "products";

const SCOPES: { id: SearchScope; label: string }[] = [
  { id: "all", label: "All" },
  { id: "customers", label: "Customers" },
  { id: "orders", label: "Orders" },
  { id: "products", label: "Products" },
];

function formatInr(value: number): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

function orderTotal(o: OrderDto): number {
  return o.totalAmount ?? o.total ?? o.amount ?? 0;
}

export function GlobalSearch({ className }: { className?: string }) {
  const router = useRouter();
  const { status } = useSession();
  const commandOpen = useUiStore((s) => s.commandOpen);
  const setCommandOpen = useUiStore((s) => s.setCommandOpen);

  const inputRef = React.useRef<HTMLInputElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);

  const [query, setQuery] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  const [scope, setScope] = React.useState<SearchScope>("all");
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    const t = window.setTimeout(() => setDebounced(query.trim()), 250);
    return () => window.clearTimeout(t);
  }, [query]);

  React.useEffect(() => {
    if (commandOpen) {
      setOpen(true);
      inputRef.current?.focus();
      setCommandOpen(false);
    }
  }, [commandOpen, setCommandOpen]);

  React.useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        panelRef.current?.contains(target) ||
        inputRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const enabled = status === "authenticated" && open;

  const { data: products = [], isFetching: loadingProducts } = useQuery({
    queryKey: ["admin-products", "global-search"],
    queryFn: async () => {
      const res = await clientFetch("/api/bff/admin/products");
      if (!res.ok) return [] as ProductDto[];
      return res.json() as Promise<ProductDto[]>;
    },
    enabled,
    staleTime: 60_000,
  });

  const { data: orders = [], isFetching: loadingOrders } = useQuery({
    queryKey: ["admin-orders", "global-search"],
    queryFn: async () => {
      const res = await clientFetch("/api/bff/admin/orders");
      if (!res.ok) return [] as OrderDto[];
      return res.json() as Promise<OrderDto[]>;
    },
    enabled,
    staleTime: 30_000,
  });

  const { data: customersPage, isFetching: loadingCustomers } = useQuery({
    queryKey: ["admin-customers", "global-search", debounced],
    queryFn: async () => {
      const q = new URLSearchParams({ page: "1", limit: "40" });
      if (debounced) {
        if (/^\d+$/.test(debounced)) q.set("phone", debounced);
        else q.set("name", debounced);
      }
      const res = await clientFetch(`/api/bff/admin/customers?${q}`);
      if (!res.ok) {
        return {
          data: [],
          total: 0,
          page: 1,
          limit: 40,
        } as PaginatedCustomersDto;
      }
      return res.json() as Promise<PaginatedCustomersDto>;
    },
    enabled,
    staleTime: 20_000,
  });

  const customers = customersPage?.data ?? [];

  const q = debounced.toLowerCase();

  const matchedProducts = React.useMemo(() => {
    if (scope !== "all" && scope !== "products") return [];
    if (!q) return products.slice(0, 6);
    return products
      .filter((p) => {
        const hay = [p.name, p.category, p.id]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      })
      .slice(0, 8);
  }, [products, q, scope]);

  const matchedOrders = React.useMemo(() => {
    if (scope !== "all" && scope !== "orders") return [];
    if (!q) {
      return [...orders]
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
        .slice(0, 6);
    }
    return orders
      .filter((o) => {
        const hay = [
          o.id,
          o.status,
          o.statusLabel,
          o.user?.name,
          o.user?.phone,
          o.deliveryStatus,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      })
      .slice(0, 8);
  }, [orders, q, scope]);

  const matchedCustomers = React.useMemo(() => {
    if (scope !== "all" && scope !== "customers") return [];
    if (!q) return customers.slice(0, 6);
    return customers
      .filter((c) => {
        const hay = [c.name, c.phone, c.id].join(" ").toLowerCase();
        return hay.includes(q);
      })
      .slice(0, 8);
  }, [customers, q, scope]);

  const loading = loadingProducts || loadingOrders || loadingCustomers;
  const hasResults =
    matchedCustomers.length > 0 ||
    matchedOrders.length > 0 ||
    matchedProducts.length > 0;

  function go(href: string) {
    setOpen(false);
    setQuery("");
    router.push(href);
  }

  return (
    <div className={cn("relative w-full max-w-xl", className)} ref={panelRef}>
      <div className="relative">
        <Search
          className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2"
          aria-hidden
        />
        <Input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search customers, orders, products…"
          className="h-9 pl-9 pr-16"
          aria-label="Global search"
          aria-expanded={open}
          aria-controls="global-search-results"
          autoComplete="off"
        />
        <kbd className="text-muted-foreground pointer-events-none absolute top-1/2 right-2 hidden -translate-y-1/2 rounded border px-1.5 py-0.5 text-[10px] font-medium sm:inline-block">
          ⌘K
        </kbd>
      </div>

      {open ? (
        <div
          id="global-search-results"
          role="listbox"
          className="bg-popover absolute top-[calc(100%+0.5rem)] z-50 w-full overflow-hidden rounded-xl border shadow-lg"
        >
          <div className="flex flex-wrap gap-1 border-b p-2">
            {SCOPES.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setScope(s.id)}
                className={cn(
                  "inline-flex h-7 items-center rounded-full border px-2.5 text-xs font-medium transition-colors",
                  scope === s.id
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-muted-foreground hover:bg-muted"
                )}
              >
                {s.label}
              </button>
            ))}
          </div>

          <div className="max-h-[min(70vh,28rem)] overflow-y-auto p-1.5">
            {loading && !hasResults ? (
              <p className="text-muted-foreground px-3 py-6 text-center text-sm">
                Searching…
              </p>
            ) : !hasResults ? (
              <p className="text-muted-foreground px-3 py-6 text-center text-sm">
                {debounced
                  ? "No matches found."
                  : "Type to search, or browse recent below."}
              </p>
            ) : (
              <div className="space-y-2 py-1">
                {(scope === "all" || scope === "customers") &&
                matchedCustomers.length > 0 ? (
                  <ResultSection
                    icon={Users}
                    title="Customers"
                    onViewAll={() => go("/customers")}
                  >
                    {matchedCustomers.map((c) => (
                      <ResultRow
                        key={c.id}
                        onSelect={() => go("/customers")}
                        title={c.name || "—"}
                        subtitle={c.phone}
                        meta={`${c.orderCount ?? 0} orders`}
                      />
                    ))}
                  </ResultSection>
                ) : null}

                {(scope === "all" || scope === "orders") &&
                matchedOrders.length > 0 ? (
                  <ResultSection
                    icon={ShoppingCart}
                    title="Orders"
                    onViewAll={() => go("/orders")}
                  >
                    {matchedOrders.map((o) => (
                      <ResultRow
                        key={o.id}
                        onSelect={() => go("/orders")}
                        title={o.user?.name ?? o.user?.phone ?? "Order"}
                        subtitle={`${format(new Date(o.createdAt), "MMM d, HH:mm")} · ${o.statusLabel ?? o.status}`}
                        meta={formatInr(orderTotal(o))}
                      />
                    ))}
                  </ResultSection>
                ) : null}

                {(scope === "all" || scope === "products") &&
                matchedProducts.length > 0 ? (
                  <ResultSection
                    icon={Package}
                    title="Products"
                    onViewAll={() => go("/products")}
                  >
                    {matchedProducts.map((p) => (
                      <ResultRow
                        key={p.id}
                        onSelect={() => go("/products")}
                        title={p.name}
                        subtitle={p.category?.trim() || "Uncategorized"}
                        meta={`${formatInr(productSalePrice(p))} · stock ${p.stock}`}
                      />
                    ))}
                  </ResultSection>
                ) : null}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ResultSection({
  icon: Icon,
  title,
  onViewAll,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  onViewAll: () => void;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-muted-foreground flex items-center justify-between px-2 py-1.5 text-[11px] font-medium tracking-wide uppercase">
        <span className="inline-flex items-center gap-1.5">
          <Icon className="size-3.5" />
          {title}
        </span>
        <button
          type="button"
          onClick={onViewAll}
          className="hover:text-foreground text-[11px] normal-case tracking-normal"
        >
          View all
        </button>
      </div>
      <ul className="space-y-0.5">{children}</ul>
    </div>
  );
}

function ResultRow({
  title,
  subtitle,
  meta,
  onSelect,
}: {
  title: string;
  subtitle: string;
  meta?: string;
  onSelect: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className="hover:bg-muted flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left transition-colors"
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{title}</p>
          <p className="text-muted-foreground truncate text-xs">{subtitle}</p>
        </div>
        {meta ? (
          <Badge variant="secondary" className="mt-0.5 shrink-0 text-[10px]">
            {meta}
          </Badge>
        ) : null}
      </button>
    </li>
  );
}
