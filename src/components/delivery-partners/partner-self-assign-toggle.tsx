"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { updatePartnerSelfAssignAction } from "@/lib/actions/delivery-partners";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export function PartnerSelfAssignToggle({
  initialEnabled,
}: {
  initialEnabled: boolean;
}) {
  const router = useRouter();
  const [enabled, setEnabled] = React.useState(initialEnabled);
  const [pending, setPending] = React.useState(false);

  React.useEffect(() => {
    setEnabled(initialEnabled);
  }, [initialEnabled]);

  async function onCheckedChange(next: boolean) {
    const previous = enabled;
    setEnabled(next);
    setPending(true);
    const r = await updatePartnerSelfAssignAction(next);
    setPending(false);
    if (!r.ok) {
      setEnabled(previous);
      toast.error(r.error ?? "Could not update self-assign");
      return;
    }
    toast.success(
      next
        ? "Partner self-assign is on. Online riders will be offered new orders."
        : "Partner self-assign is off. Assign riders from Orders.",
    );
    router.refresh();
  }

  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
      <div className="grid gap-1">
        <Label htmlFor="partner-self-assign" className="text-base">
          Partner self-assign
        </Label>
        <p className="text-muted-foreground text-sm">
          When on, new orders are offered to online delivery partners and they
          can accept. When off, only an admin can assign a driver.
        </p>
      </div>
      <Switch
        id="partner-self-assign"
        checked={enabled}
        disabled={pending}
        onCheckedChange={onCheckedChange}
        aria-label="Partner self-assign"
      />
    </div>
  );
}
