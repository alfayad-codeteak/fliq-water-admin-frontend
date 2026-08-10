import type { Metadata } from "next";

import { auth } from "@/auth";
import { loadDeliveryZones } from "@/lib/api/admin-list";
import type { DeliveryZoneDto } from "@/lib/api/types";
import { DeliveryZonesTable } from "./delivery-zones-table";

export const metadata: Metadata = {
  title: "Delivery zones",
};

export default async function DeliveryZonesPage() {
  const session = await auth();
  let initial: DeliveryZoneDto[] = [];
  if (session?.accessToken) {
    initial = await loadDeliveryZones();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Delivery zones</h1>
        <p className="text-muted-foreground text-sm">
          Store locations and service radius used to validate customer addresses.
        </p>
      </div>
      <DeliveryZonesTable initialData={initial} />
    </div>
  );
}
