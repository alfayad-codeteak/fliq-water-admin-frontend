import type { Metadata } from "next";

import { auth } from "@/auth";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = {
  title: "Settings",
};

export default async function SettingsPage() {
  const session = await auth();
  const user = session?.user;
  const permissions = user?.permissions ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
        <p className="text-muted-foreground text-sm">
          Your signed-in account details.
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="space-y-1">
          <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            Name
          </p>
          <p className="text-base font-medium">{user?.name || "—"}</p>
        </div>
        <div className="space-y-1">
          <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            Phone
          </p>
          <p className="font-mono text-base">{user?.phone || "—"}</p>
        </div>
        <div className="space-y-1">
          <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            Role
          </p>
          <div>
            <Badge variant="secondary" className="capitalize">
              {user?.role || "—"}
            </Badge>
          </div>
        </div>
        <div className="space-y-1 sm:col-span-2">
          <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            Permissions
          </p>
          {permissions.length === 0 ? (
            <p className="text-muted-foreground text-sm">No permissions listed</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {permissions.map((p) => (
                <Badge key={p} variant="outline">
                  {p}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
