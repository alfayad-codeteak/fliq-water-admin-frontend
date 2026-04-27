import type { Metadata } from "next";

import { auth } from "@/auth";
import { backendFetch } from "@/lib/api/server-fetch";
import type { PaginatedCustomersDto } from "@/lib/api/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CustomersTable } from "./customers-table";

export const metadata: Metadata = {
  title: "Customers",
};

export default async function CustomersPage() {
  const session = await auth();
  let initial: PaginatedCustomersDto | null = null;
  if (session?.accessToken) {
    const res = await backendFetch("/api/admin/customers?page=1&limit=20");
    if (res.ok) {
      initial = (await res.json()) as PaginatedCustomersDto;
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Customers</h1>
        <p className="text-muted-foreground text-sm">
          Paginated directory with filters.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Directory</CardTitle>
          <CardDescription>
            Search by phone or name using query parameters.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CustomersTable initialData={initial} />
        </CardContent>
      </Card>
    </div>
  );
}
