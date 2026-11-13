import type { Metadata } from "next";

import { auth } from "@/auth";
import { loadDepositTransactions, loadDepositWallets } from "@/lib/api/admin-list";
import { backendFetch } from "@/lib/api/server-fetch";
import type {
  CustomerRowDto,
  DepositConfigDto,
  DepositTransactionDto,
  WalletDto,
} from "@/lib/api/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DepositsPanel } from "./deposits-panel";
import { DepositTransactionsTable } from "./deposit-transactions-table";

export const metadata: Metadata = {
  title: "Deposits",
};

export default async function DepositsPage() {
  const session = await auth();
  let config: DepositConfigDto | null = null;
  let myWallet: WalletDto | null = null;
  let customers: CustomerRowDto[] = [];
  let transactions: DepositTransactionDto[] = [];

  if (session?.accessToken) {
    const [configRes, walletRes, walletRows, txRows] = await Promise.all([
      backendFetch("/api/deposits/config"),
      backendFetch("/api/deposits/wallet/me"),
      loadDepositWallets(),
      loadDepositTransactions(),
    ]);

    if (configRes.ok) config = (await configRes.json()) as DepositConfigDto;
    if (walletRes.ok) myWallet = (await walletRes.json()) as WalletDto;
    customers = walletRows;
    transactions = txRows;
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
            Update offers, add held deposit, or give deposit back when cans are returned.
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
      <Card>
        <CardHeader>
          <CardTitle>Transaction history</CardTitle>
          <CardDescription>
            Every hold, credit, and return across customer deposit wallets.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DepositTransactionsTable rows={transactions} />
        </CardContent>
      </Card>
    </div>
  );
}
