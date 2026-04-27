import type { Session } from "next-auth";

import type { FeatureKey } from "@/lib/api/types";

export function isOwner(session: Session | null): boolean {
  return session?.user?.role === "owner";
}

export function canUseFeature(session: Session | null, key: FeatureKey): boolean {
  if (!session?.user) return false;
  if (session.user.role === "owner") return true;
  return session.user.permissions?.includes(key) ?? false;
}
