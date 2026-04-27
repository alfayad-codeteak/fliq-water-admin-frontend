"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  addCustomerWalletDepositAction,
  updateDepositConfigAction,
} from "@/lib/actions/deposits";
import type { CustomerRowDto, DepositConfigDto, WalletDto } from "@/lib/api/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export function DepositsPanel({
  initialConfig,
  initialWallet,
  customers,
}: {
  initialConfig: DepositConfigDto | null;
  initialWallet: WalletDto | null;
  customers: CustomerRowDto[];
}) {
  const router = useRouter();
  const [savingConfig, setSavingConfig] = React.useState(false);
  const [addingWallet, setAddingWallet] = React.useState(false);
  const [enabled, setEnabled] = React.useState(initialConfig?.enabled ?? true);
  const [perCanAmount, setPerCanAmount] = React.useState(
    String(initialConfig?.perCanAmount ?? 0)
  );

  React.useEffect(() => {
    setEnabled(initialConfig?.enabled ?? true);
    setPerCanAmount(String(initialConfig?.perCanAmount ?? 0));
  }, [initialConfig]);

  return (
    <div className="grid gap-6">
      <form
        className="grid gap-4 rounded-lg border p-4"
        action={async (fd) => {
          setSavingConfig(true);
          const r = await updateDepositConfigAction(fd);
          setSavingConfig(false);
          if (!r.ok) {
            toast.error(r.error ?? "Failed to update deposit config");
            return;
          }
          toast.success("Deposit config updated");
          router.refresh();
        }}
      >
        <h3 className="text-base font-semibold">Deposit configuration</h3>
        <input type="hidden" name="enabled" value={enabled ? "true" : "false"} />
        <div className="flex items-center justify-between rounded-md border p-3">
          <div className="grid gap-0.5">
            <Label htmlFor="dep-enabled">Enable deposits</Label>
            <p className="text-muted-foreground text-xs">
              When disabled, deposit charge/discount is zero and no deposit transaction
              is created.
            </p>
          </div>
          <Switch
            id="dep-enabled"
            checked={enabled}
            onCheckedChange={setEnabled}
            aria-label="Enable deposits"
          />
        </div>
        <div className="grid gap-4 md:grid-cols-1">
          <div className="grid gap-2">
            <Label htmlFor="dep-amount">Deposit amount per can</Label>
            <Input
              id="dep-amount"
              name="perCanAmount"
              type="number"
              min={0}
              step="0.01"
              value={perCanAmount}
              onChange={(e) => setPerCanAmount(e.target.value)}
              disabled={!enabled}
              required
            />
          </div>
        </div>
        <div>
          <Button type="submit" disabled={savingConfig}>
            {savingConfig ? "Saving..." : "Save deposit config"}
          </Button>
        </div>
      </form>

      <form
        className="grid gap-4 rounded-lg border p-4 md:grid-cols-[1.2fr_1fr_auto]"
        action={async (fd) => {
          setAddingWallet(true);
          const r = await addCustomerWalletDepositAction(fd);
          setAddingWallet(false);
          if (!r.ok) {
            toast.error(r.error ?? "Could not add deposit");
            return;
          }
          toast.success("Deposit credited to customer wallet");
          router.refresh();
        }}
      >
        <div className="grid gap-2">
          <Label htmlFor="cust-user">Customer</Label>
          <select
            id="cust-user"
            name="userId"
            className="border-input bg-background h-9 rounded-md border px-3 text-sm"
            required
            defaultValue=""
          >
            <option value="" disabled>
              Select customer
            </option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.phone})
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="cust-amount">Amount</Label>
          <Input
            id="cust-amount"
            name="amount"
            type="number"
            min={1}
            step="0.01"
            placeholder="100"
            required
          />
        </div>
        <div className="flex items-end">
          <Button type="submit" disabled={addingWallet}>
            {addingWallet ? "Adding..." : "Add to wallet"}
          </Button>
        </div>
      </form>
    </div>
  );
}
