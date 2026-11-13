"use client";

import * as React from "react";
import { format } from "date-fns";
import {
  Banknote,
  Bike,
  ChevronDown,
  Download,
  IndianRupee,
  Package,
  Truck,
  Wallet,
} from "lucide-react";

import { clientFetch } from "@/lib/api/client-fetch";
import type {
  DeliveryPartnerReportDto,
  DeliveryPartnerReportOrderDto,
  DeliveryPartnerReportRowDto,
} from "@/lib/api/types";
import {
  addCalendarDays,
  calendarDateInKolkata,
} from "@/lib/orders/schedule";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { TableFilterChips } from "@/components/ui/data-table/table-filter-chips";
import { TableSearchInput } from "@/components/ui/data-table/table-search-input";
import { TableStatCards } from "@/components/ui/data-table/table-stat-cards";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { DashboardBarChart, DashboardLineChart } from "../dashboard/dashboard-charts";

type RangeId = "today" | "7d" | "month" | "last-month" | "all";

function money(value: number): string {
  return `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function csvEscape(value: string | number | null | undefined): string {
  const text = value == null ? "" : String(value);
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function downloadCsv(filename: string, header: string[], rows: Array<Array<string | number | null>>) {
  const body = [header, ...rows]
    .map((line) => line.map(csvEscape).join(","))
    .join("\n");
  const blob = new Blob([body], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function rangeFor(id: RangeId): { dateFrom?: string; dateTo?: string } {
  const today = calendarDateInKolkata();
  if (id === "today") return { dateFrom: today, dateTo: today };
  if (id === "7d") return { dateFrom: addCalendarDays(today, -6), dateTo: today };
  if (id === "month") return { dateFrom: `${today.slice(0, 7)}-01`, dateTo: today };
  if (id === "last-month") {
    const thisMonthStart = `${today.slice(0, 7)}-01`;
    const lastMonthEnd = addCalendarDays(thisMonthStart, -1);
    return { dateFrom: `${lastMonthEnd.slice(0, 7)}-01`, dateTo: lastMonthEnd };
  }
  return {};
}

function detectRange(dateFrom: string | null, dateTo: string | null): RangeId {
  const today = calendarDateInKolkata();
  if (!dateFrom && !dateTo) return "all";
  if (dateFrom === today && dateTo === today) return "today";
  if (dateFrom === addCalendarDays(today, -6) && dateTo === today) return "7d";
  if (dateFrom === `${today.slice(0, 7)}-01` && dateTo === today) return "month";
  const lastMonthEnd = addCalendarDays(`${today.slice(0, 7)}-01`, -1);
  if (dateFrom === `${lastMonthEnd.slice(0, 7)}-01` && dateTo === lastMonthEnd) {
    return "last-month";
  }
  return "month";
}

export function PartnerReport({ initial }: { initial: DeliveryPartnerReportDto }) {
  const [range, setRange] = React.useState<RangeId>(
    detectRange(initial.dateFrom, initial.dateTo),
  );
  const [partnerId, setPartnerId] = React.useState("");
  const [query, setQuery] = React.useState("");
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [report, setReport] = React.useState(initial);
  const [roster, setRoster] = React.useState(initial.partners);
  const [loading, setLoading] = React.useState(false);

  const load = React.useCallback(async (nextRange: RangeId, nextPartnerId: string) => {
    setLoading(true);
    try {
      const bounds = rangeFor(nextRange);
      const q = new URLSearchParams();
      if (bounds.dateFrom) q.set("dateFrom", bounds.dateFrom);
      if (bounds.dateTo) q.set("dateTo", bounds.dateTo);
      if (nextPartnerId) q.set("partnerId", nextPartnerId);
      const suffix = q.toString() ? `?${q.toString()}` : "";
      const res = await clientFetch(`/api/bff/admin/reports/delivery-partners${suffix}`);
      if (!res.ok) throw new Error("Failed to load report");
      const data = (await res.json()) as DeliveryPartnerReportDto;
      setReport(data);
      if (!nextPartnerId) {
        setRoster(data.partners);
      }
    } catch {
      // keep the last successful snapshot
    } finally {
      setLoading(false);
    }
  }, []);

  const partners = React.useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return report.partners;
    return report.partners.filter(
      (row) =>
        row.name.toLowerCase().includes(term) ||
        row.phone.toLowerCase().includes(term) ||
        (row.vehicleNumber ?? "").toLowerCase().includes(term),
    );
  }, [report.partners, query]);

  const ordersByPartner = React.useMemo(() => {
    const map = new Map<string, DeliveryPartnerReportOrderDto[]>();
    for (const order of report.orders) {
      const list = map.get(order.partnerId) ?? [];
      list.push(order);
      map.set(order.partnerId, list);
    }
    return map;
  }, [report.orders]);

  const t = report.totals;
  const barData = partners
    .filter((row) => row.deliveredAmount > 0 || row.assignedAmount > 0)
    .slice(0, 8)
    .map((row) => ({
      label: row.name.split(" ")[0] || row.name,
      value: Math.round(row.deliveredAmount),
    }));
  const lineData = report.daily.map((row) => ({
    label: format(new Date(`${row.date}T12:00:00+05:30`), "d MMM"),
    value: Math.round(row.amount),
  }));

  const exportPartners = () => {
    downloadCsv(
      `partner-report-${report.dateFrom ?? "all"}-${report.dateTo ?? "now"}.csv`,
      [
        "Partner",
        "Phone",
        "Vehicle",
        "Orders",
        "Delivered",
        "In progress",
        "Cancelled",
        "Assigned amount",
        "Delivered amount",
        "COD collected",
        "COD outstanding",
        "Cans",
        "Empty cans in",
      ],
      partners.map((row) => [
        row.name,
        row.phone,
        [row.vehicleType, row.vehicleNumber].filter(Boolean).join(" "),
        row.orderCount,
        row.deliveredCount,
        row.inProgressCount,
        row.cancelledCount,
        row.assignedAmount,
        row.deliveredAmount,
        row.codCollected,
        row.codOutstanding,
        row.cansDelivered,
        row.emptyCansCollected,
      ]),
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <TableFilterChips
          activeId={range}
          onChange={(id) => {
            const next = id as RangeId;
            setRange(next);
            void load(next, partnerId);
          }}
          chips={[
            { id: "today", label: "Today" },
            { id: "7d", label: "Last 7 days" },
            { id: "month", label: "This month" },
            { id: "last-month", label: "Last month" },
            { id: "all", label: "All time" },
          ]}
        />
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="border-input bg-background h-9 rounded-md border px-3 text-sm"
            value={partnerId}
            onChange={(event) => {
              const next = event.target.value;
              setPartnerId(next);
              void load(range, next);
            }}
            aria-label="Filter by delivery partner"
          >
            <option value="">All partners</option>
            {roster.map((row) => (
              <option key={row.id} value={row.id}>
                {row.name}
              </option>
            ))}
          </select>
          <Button type="button" variant="outline" onClick={exportPartners}>
            <Download />
            Export CSV
          </Button>
        </div>
      </div>

      <TableStatCards
        items={[
          { label: "Partners", value: t.partnerCount, icon: Bike },
          { label: "Assigned orders", value: t.orderCount, icon: Truck },
          { label: "Delivered", value: t.deliveredCount, icon: Package },
          { label: "Delivered amount", value: money(t.deliveredAmount), icon: IndianRupee },
          { label: "COD collected", value: money(t.codCollected), icon: Banknote },
          { label: "COD outstanding", value: money(t.codOutstanding), icon: Wallet },
          { label: "Cans out", value: t.cansDelivered, icon: Package },
          {
            label: "Unassigned orders",
            value: t.unassignedCount,
            icon: Truck,
          },
        ]}
      />

      <p className="text-muted-foreground -mt-3 text-xs">
        {report.dateFrom || report.dateTo
          ? `India dates ${report.dateFrom ?? "…"} → ${report.dateTo ?? "…"}`
          : "All dates"}
        {t.unassignedAmount > 0
          ? ` · Unassigned value ${money(t.unassignedAmount)}`
          : ""}
        {loading ? " · Refreshing…" : ""}
      </p>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Delivered amount by partner</CardTitle>
            <CardDescription>Top partners in this range</CardDescription>
          </CardHeader>
          <CardContent>
            {barData.length === 0 ? (
              <p className="text-muted-foreground text-sm">No delivered orders in this range.</p>
            ) : (
              <DashboardBarChart data={barData} />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Daily assigned value</CardTitle>
            <CardDescription>Order totals by India calendar day</CardDescription>
          </CardHeader>
          <CardContent>
            {lineData.length === 0 ? (
              <p className="text-muted-foreground text-sm">No assigned orders in this range.</p>
            ) : (
              <DashboardLineChart data={lineData} />
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="gap-3">
          <div>
            <CardTitle>Partner breakdown</CardTitle>
            <CardDescription>
              Orders, cash, cans, and status for each driver. Expand a row for recent orders.
            </CardDescription>
          </div>
          <TableSearchInput
            value={query}
            onChange={setQuery}
            placeholder="Search partner, phone, or vehicle"
            aria-label="Search partners in report"
          />
        </CardHeader>
        <CardContent>
          {partners.length === 0 ? (
            <p className="text-muted-foreground text-sm">No delivery partners yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Partner</TableHead>
                  <TableHead className="text-right">Orders</TableHead>
                  <TableHead className="text-right">Delivered</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">COD</TableHead>
                  <TableHead className="text-right">Cans</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {partners.map((row) => (
                  <PartnerRows
                    key={row.id}
                    row={row}
                    open={openId === row.id}
                    onToggle={() => setOpenId((id) => (id === row.id ? null : row.id))}
                    orders={ordersByPartner.get(row.id) ?? []}
                  />
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function PartnerRows({
  row,
  open,
  onToggle,
  orders,
}: {
  row: DeliveryPartnerReportRowDto;
  open: boolean;
  onToggle: () => void;
  orders: DeliveryPartnerReportOrderDto[];
}) {
  const vehicle = [row.vehicleType, row.vehicleNumber].filter(Boolean).join(" · ");
  return (
    <>
      <TableRow className="cursor-pointer" onClick={onToggle}>
        <TableCell>
          <p className="font-semibold">{row.name}</p>
          <p className="font-mono text-xs text-muted-foreground">{row.phone}</p>
          <p className="text-muted-foreground text-xs">
            {vehicle || "No vehicle"}
            {row.isAvailable ? " · Online" : " · Offline"}
          </p>
        </TableCell>
        <TableCell className="text-right tabular-nums">
          {row.orderCount}
          <p className="text-muted-foreground text-[11px]">
            {row.inProgressCount} live · {row.cancelledCount} cancelled
          </p>
        </TableCell>
        <TableCell className="text-right tabular-nums">{row.deliveredCount}</TableCell>
        <TableCell className="text-right">
          <p className="font-extrabold tabular-nums">{money(row.deliveredAmount)}</p>
          <p className="text-muted-foreground text-[11px]">
            Assigned {money(row.assignedAmount)}
          </p>
        </TableCell>
        <TableCell className="text-right">
          <p className="tabular-nums">{money(row.codCollected)}</p>
          <p className="text-muted-foreground text-[11px]">
            Due {money(row.codOutstanding)}
          </p>
        </TableCell>
        <TableCell className="text-right">
          <p className="tabular-nums">{row.cansDelivered}</p>
          <p className="text-muted-foreground text-[11px]">
            Empty in {row.emptyCansCollected}/{row.emptyCansExpected}
          </p>
        </TableCell>
        <TableCell>
          <ChevronDown
            className={cn("size-4 text-muted-foreground transition", open && "rotate-180")}
          />
        </TableCell>
      </TableRow>
      {open ? (
        <TableRow>
          <TableCell colSpan={7} className="bg-muted/40">
            {orders.length === 0 ? (
              <p className="text-muted-foreground py-2 text-sm">No orders in this range.</p>
            ) : (
              <div className="space-y-2 py-1">
                {orders.map((order) => (
                  <div
                    key={order.id}
                    className="flex flex-wrap items-start justify-between gap-2 rounded-lg border bg-background px-3 py-2 text-sm"
                  >
                    <div>
                      <p className="font-semibold">
                        #{order.orderNumber} · {order.customerName}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {order.phone} · {order.status.replace(/_/g, " ")} ·{" "}
                        {order.paymentMethod} · {order.canQty} cans
                        {order.timeSlot ? ` · ${order.timeSlot}` : ""}
                      </p>
                    </div>
                    <p className="font-extrabold tabular-nums">{money(order.totalAmount)}</p>
                  </div>
                ))}
              </div>
            )}
          </TableCell>
        </TableRow>
      ) : null}
    </>
  );
}
