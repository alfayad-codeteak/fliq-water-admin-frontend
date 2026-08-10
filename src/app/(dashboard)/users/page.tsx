import type { Metadata } from "next";

import { auth } from "@/auth";
import { loadAdmins } from "@/lib/api/admin-list";
import type { AdminUserDto } from "@/lib/api/types";
import { isOwner } from "@/lib/permissions";
import { UsersTable } from "./users-table";

export const metadata: Metadata = {
  title: "Staff",
};

export default async function UsersPage() {
  const session = await auth();
  const canManage = isOwner(session);

  let initialData: AdminUserDto[] = [];
  if (session?.accessToken && canManage) {
    initialData = await loadAdmins();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Admins</h1>
        <p className="text-muted-foreground text-sm">
          Owner-only: create and manage admin accounts.
        </p>
      </div>
      <UsersTable
        initialData={initialData}
        canManage={canManage}
        currentUserId={session?.user?.id ?? ""}
      />
    </div>
  );
}
