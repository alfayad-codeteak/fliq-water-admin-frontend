"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/toast";
import { clientFetch } from "@/lib/api/client-fetch";

import {
  addCustomerWalletDepositAction,
  returnCustomerWalletDepositAction,
  updateDepositConfigAction,
} from "@/lib/actions/deposits";
import {
  depositReturnAmountError,
  formatDepositRupees,
} from "@/lib/deposits/return-amount";
import type {
  CustomerRowDto,
  DepositConfigDto,
  WalletDto,
} from "@/lib/api/types";
import { SubmitButton } from "@/components/ui/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

export function DepositsPanel({
  initialConfig,
  initialWallet: _initialWallet,
  customers,
}: {
  initialConfig: DepositConfigDto | null;
  initialWallet: WalletDto | null;
  customers: CustomerRowDto[];
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: liveCustomers } = useQuery({
    queryKey: ["admin-deposit-wallets"],
    queryFn: async () => {
      const res = await clientFetch("/api/bff/admin/deposits/wallets");
      if (!res.ok) throw new Error("Failed to load wallets");
      return (await res.json()) as CustomerRowDto[];
    },
    initialData: customers,
    refetchInterval: 15_000,
  });
  const customerRows = React.useMemo(() => {
    const rows = liveCustomers ?? customers;
    return [...rows].sort(
      (a, b) => Number(b.depositBalance ?? 0) - Number(a.depositBalance ?? 0),
    );
  }, [liveCustomers, customers]);
  const refreshWallets = React.useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["admin-deposit-wallets"] });
    void queryClient.invalidateQueries({ queryKey: ["admin-deposit-transactions"] });
    router.refresh();
  }, [queryClient, router]);
  const [enabled, setEnabled] = React.useState(initialConfig?.enabled ?? true);
  const [perCanAmount, setPerCanAmount] = React.useState(
    String(initialConfig?.perCanAmount ?? 0)
  );
  const [returnUserId, setReturnUserId] = React.useState("");
  const [returnAmount, setReturnAmount] = React.useState("");

  const returnCustomers = React.useMemo(
    () => customerRows.filter((c) => Number(c.depositBalance ?? 0) > 0),
    [customerRows],
  );
  const selectedReturnCustomer = returnCustomers.find((c) => c.id === returnUserId);
  const selectedHeld = Number(selectedReturnCustomer?.depositBalance ?? 0);
  const returnAmountError = selectedReturnCustomer
    ? depositReturnAmountError(returnAmount, selectedHeld)
    : returnAmount.trim()
      ? "Select a customer first."
      : null;

  React.useEffect(() => {
    setEnabled(initialConfig?.enabled ?? true);
    setPerCanAmount(String(initialConfig?.perCanAmount ?? 0));
  }, [initialConfig]);

  React.useEffect(() => {
    if (returnUserId && !returnCustomers.some((c) => c.id === returnUserId)) {
      setReturnUserId("");
      setReturnAmount("");
    }
  }, [returnCustomers, returnUserId]);

  return (
    <div className="grid gap-6">
      <form
        className="grid gap-4 rounded-lg border p-4"
        action={async (fd) => {
          const r = await updateDepositConfigAction(fd);
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
          <SubmitButton loadingText="Saving…">Save deposit config</SubmitButton>
        </div>
      </form>

      <div className="grid gap-4 lg:grid-cols-2">
        <form
          className="grid gap-4 rounded-lg border p-4"
          action={async (fd) => {
            const r = await addCustomerWalletDepositAction(fd);
            if (!r.ok) {
              toast.error(r.error ?? "Could not add deposit");
              return;
            }
            toast.success("Deposit credited to customer wallet");
            refreshWallets();
          }}
        >
          <h3 className="text-base font-semibold">Add deposit</h3>
          <p className="text-muted-foreground -mt-2 text-sm">
            Credit held can-deposit when the customer takes extra cans.
          </p>
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
              {customerRows.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name || "Unnamed"} ({c.phone}) — ₹
                  {Number(c.depositBalance ?? 0).toLocaleString("en-IN")}
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
          <div>
            <SubmitButton loadingText="Adding…">Add to wallet</SubmitButton>
          </div>
        </form>

        <form
          className="grid gap-4 rounded-lg border p-4"
          action={async (fd) => {
            const error = depositReturnAmountError(
              String(fd.get("amount") ?? ""),
              selectedHeld,
            );
            if (!selectedReturnCustomer || error) {
              toast.error(error ?? "Select a customer");
              return;
            }
            const r = await returnCustomerWalletDepositAction(fd);
            if (!r.ok) {
              toast.error(r.error ?? "Could not return deposit");
              return;
            }
            toast.success("Deposit given back to customer");
            setReturnUserId("");
            setReturnAmount("");
            refreshWallets();
          }}
        >
          <h3 className="text-base font-semibold">Give deposit back</h3>
          <p className="text-muted-foreground -mt-2 text-sm">
            Pay cash at the counter when empty cans are returned. Cannot exceed
            the amount this customer currently holds.
          </p>
          <div className="grid gap-2">
            <Label htmlFor="return-user">Customer</Label>
            <select
              id="return-user"
              name="userId"
              className="border-input bg-background h-9 rounded-md border px-3 text-sm"
              required
              value={returnUserId}
              onChange={(event) => {
                const nextId = event.target.value;
                setReturnUserId(nextId);
                const next = returnCustomers.find((c) => c.id === nextId);
                const held = Number(next?.depositBalance ?? 0);
                setReturnAmount(held > 0 ? String(held) : "");
              }}
            >
              <option value="" disabled>
                Select customer
              </option>
              {returnCustomers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name || "Unnamed"} ({c.phone}) —{" "}
                  {formatDepositRupees(Number(c.depositBalance ?? 0))}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="return-amount">Amount</Label>
            <Input
              id="return-amount"
              name="amount"
              type="number"
              min={1}
              max={selectedHeld || undefined}
              step="0.01"
              placeholder="100"
              required
              value={returnAmount}
              onChange={(event) => setReturnAmount(event.target.value)}
              aria-invalid={Boolean(returnAmountError)}
              aria-describedby={
                returnAmountError ? "return-amount-error" : "return-amount-hint"
              }
              className={cn(returnAmountError && "border-destructive")}
            />
            {selectedReturnCustomer ? (
              <p id="return-amount-hint" className="text-muted-foreground text-xs">
                Currently holds {formatDepositRupees(selectedHeld)}. You cannot
                return more than this.
              </p>
            ) : null}
            {returnAmountError ? (
              <p
                id="return-amount-error"
                role="alert"
                className="text-destructive text-sm font-semibold"
              >
                {returnAmountError}
              </p>
            ) : null}
          </div>
          <div>
            <SubmitButton
              loadingText="Returning…"
              disabled={Boolean(returnAmountError) || !returnUserId}
            >
              Give deposit back
            </SubmitButton>
          </div>
        </form>
      </div>

      <div className="grid gap-3">
        <h3 className="text-base font-extrabold tracking-tight">Customer wallets</h3>
        <p className="text-muted-foreground -mt-2 text-sm font-semibold">
          Deposit currently held for cans at the customer&apos;s home.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {customerRows.length === 0 ? (
            <p className="text-muted-foreground text-sm">No customers yet.</p>
          ) : (
            customerRows.map((c) => {
              const held = Number(c.depositBalance ?? 0);
              return (
                <div
                  key={c.id}
                  className="rounded-2xl border p-4 shadow-sm"
                >
                  <p className="truncate text-sm font-extrabold">{c.name || "Unnamed"}</p>
                  <p className="font-mono text-xs font-semibold text-slate-500">{c.phone}</p>
                  <p className="mt-3 text-[10px] font-bold tracking-[0.12em] text-slate-400 uppercase">
                    Wallet
                  </p>
                  <p className="text-2xl font-extrabold tabular-nums">
                    ₹{held.toLocaleString("en-IN")}
                  </p>
                  {held > 0 ? (
                    <WalletReturnForm
                      userId={c.id}
                      held={held}
                      onReturned={refreshWallets}
                    />
                  ) : null}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

function WalletReturnForm({
  userId,
  held,
  onReturned,
}: {
  userId: string;
  held: number;
  onReturned: () => void;
}) {
  const [amount, setAmount] = React.useState(String(held));
  const error = depositReturnAmountError(amount, held);

  React.useEffect(() => {
    setAmount(String(held));
  }, [held]);

  return (
    <form
      className="mt-3 grid gap-2"
      action={async (fd) => {
        const nextError = depositReturnAmountError(String(fd.get("amount") ?? ""), held);
        if (nextError) {
          toast.error(nextError);
          return;
        }
        const r = await returnCustomerWalletDepositAction(fd);
        if (!r.ok) {
          toast.error(r.error ?? "Could not return deposit");
          return;
        }
        toast.success("Deposit given back to customer");
        onReturned();
      }}
    >
      <input type="hidden" name="userId" value={userId} />
      <Label
        htmlFor={`return-${userId}`}
        className="text-[10px] font-bold tracking-[0.12em] uppercase"
      >
        Return amount
      </Label>
      <div className="flex gap-2">
        <Input
          id={`return-${userId}`}
          name="amount"
          type="number"
          min={1}
          max={held}
          step="0.01"
          required
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          aria-invalid={Boolean(error)}
          className={cn(error && "border-destructive")}
        />
        <SubmitButton loadingText="Returning…" disabled={Boolean(error)}>
          Give back
        </SubmitButton>
      </div>
      {error ? (
        <p role="alert" className="text-destructive text-xs font-semibold">
          {error}
        </p>
      ) : null}
    </form>
  );
}
