import type { Metadata } from "next";

import { auth } from "@/auth";
import { backendFetch } from "@/lib/api/server-fetch";
import type { DeliveryPartnerDto } from "@/lib/api/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DeliveryPartnersTable } from "./delivery-partners-table";

export const metadata: Metadata = {
  title: "Delivery partners",
};

export default async function DeliveryPartnersPage() {
  const session = await auth();
  let initial: DeliveryPartnerDto[] = [];
  if (session?.accessToken) {
    const res = await backendFetch("/api/admin/delivery-partners");
    if (res.ok) {
      initial = (await res.json()) as DeliveryPartnerDto[];
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Delivery partners
        </h1>
        <p className="text-muted-foreground text-sm">
          Drivers for last-mile delivery: create accounts, vehicles, and
          availability.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Partners</CardTitle>
          <CardDescription>
            Uses DeliveryPartner ids when assigning orders (not user ids).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DeliveryPartnersTable initialData={initial} />
        </CardContent>
      </Card>
    </div>
  );
}
