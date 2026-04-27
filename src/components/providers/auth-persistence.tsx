"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

import {
  clearAuthStorage,
  hasAuthStorage,
  saveAuthToStorage,
} from "@/lib/auth-storage";

function isPublicPath(pathname: string) {
  return pathname === "/login" || pathname === "/";
}

export function AuthPersistence() {
  const pathname = usePathname();
  const router = useRouter();
  const { status, data: session } = useSession();

  React.useEffect(() => {
    if (status === "authenticated" && session?.user) {
      saveAuthToStorage({
        id: session.user.id,
        phone: session.user.phone,
        role: session.user.role,
        permissions: session.user.permissions,
      });
    }
  }, [status, session]);

  React.useEffect(() => {
    if (status === "loading") return;
    if (isPublicPath(pathname)) return;

    if (status === "unauthenticated") {
      clearAuthStorage();
      router.replace("/login");
      return;
    }

    // If browser auth snapshot is missing, deny protected page access.
    if (!hasAuthStorage()) {
      router.replace("/login");
    }
  }, [status, pathname, router]);

  return null;
}
