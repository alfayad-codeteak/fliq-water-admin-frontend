import type { Metadata } from "next";

import { auth } from "@/auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = {
  title: "Settings",
};

export default async function SettingsPage() {
  const session = await auth();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground text-sm">
          Session comes from your backend sign-in.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Session</CardTitle>
          <CardDescription>
            Permissions drive navigation until the backend enforces them per route.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="grid gap-1">
            <span className="text-muted-foreground">Name</span>
            <span className="font-medium">{session?.user?.name ?? "—"}</span>
          </div>
          <div className="grid gap-1">
            <span className="text-muted-foreground">Phone</span>
            <span className="font-mono">{session?.user?.phone ?? "—"}</span>
          </div>
          <div className="grid gap-1">
            <span className="text-muted-foreground">Role</span>
            <Badge>{session?.user?.role ?? "—"}</Badge>
          </div>
          <div className="grid gap-1">
            <span className="text-muted-foreground">Permissions</span>
            <div className="flex flex-wrap gap-1">
              {(session?.user?.permissions?.length ?? 0) === 0 ? (
                <span className="text-muted-foreground">—</span>
              ) : (
                session?.user?.permissions?.map((p) => (
                  <Badge key={p} variant="secondary">
                    {p}
                  </Badge>
                ))
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Backend</CardTitle>
          <CardDescription>
            Point the app at your backend using environment variables. Authenticated
            requests are proxied from the server to avoid browser CORS issues.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
