import type { Metadata } from "next";

import { auth } from "@/auth";
import { backendFetch } from "@/lib/api/server-fetch";
import type { AdminUserDto } from "@/lib/api/types";
import { isOwner } from "@/lib/permissions";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { UsersTable } from "./users-table";

export const metadata: Metadata = {
  title: "Staff",
};

export default async function UsersPage() {
  const session = await auth();
  const canManage = isOwner(session);

  let initialData: AdminUserDto[] = [];
  if (session?.accessToken && canManage) {
    const res = await backendFetch("/api/owner/admins");
    if (res.ok) {
      initialData = (await res.json()) as AdminUserDto[];
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Admins</h1>
        <p className="text-muted-foreground text-sm">
          Owner-only: create and manage admin accounts.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Team</CardTitle>
          <CardDescription>
            {canManage
              ? "Create admins and assign feature permissions."
              : "Only workspace owners can manage staff accounts."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <UsersTable
            initialData={initialData}
            canManage={canManage}
            currentUserId={session?.user?.id ?? ""}
          />
        </CardContent>
      </Card>
    </div>
  );
}
