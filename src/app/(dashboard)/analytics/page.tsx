import type { Metadata } from "next";

import { auth } from "@/auth";
import { loadDeliveryPartnerReport } from "@/lib/api/admin-list";
import { calendarDateInKolkata } from "@/lib/orders/schedule";
import { PartnerReport } from "./partner-report";

export const metadata: Metadata = {
  title: "Reports",
};

export default async function AnalyticsPage() {
  const session = await auth();
  const today = calendarDateInKolkata();
  const dateFrom = `${today.slice(0, 7)}-01`;
  const report = session?.accessToken
    ? await loadDeliveryPartnerReport({ dateFrom, dateTo: today })
    : {
        dateFrom,
        dateTo: today,
        totals: {
          partnerCount: 0,
          availableCount: 0,
          orderCount: 0,
          deliveredCount: 0,
          inProgressCount: 0,
          cancelledCount: 0,
          assignedAmount: 0,
          deliveredAmount: 0,
          codAmount: 0,
          codCollected: 0,
          codOutstanding: 0,
          handlingTotal: 0,
          depositCharged: 0,
          cansDelivered: 0,
          emptyCansExpected: 0,
          emptyCansCollected: 0,
          unassignedCount: 0,
          unassignedAmount: 0,
        },
        partners: [],
        daily: [],
        orders: [],
      };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
        <p className="text-muted-foreground text-sm">
          Delivery partner orders, collected amount, COD, and cans for the selected dates.
        </p>
      </div>
      <PartnerReport initial={report} />
    </div>
  );
}
