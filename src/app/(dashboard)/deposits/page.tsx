import type { Metadata } from "next";

import { auth } from "@/auth";
import { backendFetch } from "@/lib/api/server-fetch";
import type {
  CustomerRowDto,
  DepositConfigDto,
  PaginatedCustomersDto,
  WalletDto,
} from "@/lib/api/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DepositsPanel } from "./deposits-panel";

export const metadata: Metadata = {
  title: "Deposits",
};

export default async function DepositsPage() {
  const session = await auth();
  let config: DepositConfigDto | null = null;
  let myWallet: WalletDto | null = null;
  let customers: CustomerRowDto[] = [];

  if (session?.accessToken) {
    const [configRes, walletRes, customersRes] = await Promise.all([
      backendFetch("/api/deposits/config"),
      backendFetch("/api/deposits/wallet/me"),
      backendFetch("/api/admin/customers?page=1&limit=200"),
    ]);

    if (configRes.ok) config = (await configRes.json()) as DepositConfigDto;
    if (walletRes.ok) myWallet = (await walletRes.json()) as WalletDto;
    if (customersRes.ok) {
      const body = (await customersRes.json()) as PaginatedCustomersDto;
      customers = body.data ?? [];
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Deposits</h1>
        <p className="text-muted-foreground text-sm">
          Set deposit rules and manage wallet balances.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Deposit operations</CardTitle>
          <CardDescription>
            Update offers, top up wallets, and add deposit balance for customers.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DepositsPanel
            initialConfig={config}
            initialWallet={myWallet}
            customers={customers}
          />
        </CardContent>
      </Card>
    </div>
  );
}
