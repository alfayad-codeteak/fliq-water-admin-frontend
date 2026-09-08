import type { Metadata } from "next";

import { auth } from "@/auth";
import { loadDeliveryPartners, loadDispatchSettings } from "@/lib/api/admin-list";
import type { DeliveryPartnerDto } from "@/lib/api/types";
import { PartnerSelfAssignToggle } from "@/components/delivery-partners/partner-self-assign-toggle";
import { DeliveryPartnersTable } from "./delivery-partners-table";

export const metadata: Metadata = {
  title: "Delivery partners",
};

export default async function DeliveryPartnersPage() {
  const session = await auth();
  let initial: DeliveryPartnerDto[] = [];
  let selfAssignEnabled = true;
  if (session?.accessToken) {
    const [partners, settings] = await Promise.all([
      loadDeliveryPartners(),
      loadDispatchSettings(),
    ]);
    initial = partners;
    selfAssignEnabled = settings.partnerSelfAssignEnabled;
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
      <PartnerSelfAssignToggle initialEnabled={selfAssignEnabled} />
      <DeliveryPartnersTable initialData={initial} />
    </div>
  );
}
