import type { DefaultSession } from "next-auth";
import type { FeatureKey, ApiRole } from "@/lib/api/types";

declare module "next-auth" {
  interface Session {
    accessToken: string;
    user: DefaultSession["user"] & {
      id: string;
      name: string;
      email?: string | null;
      phone: string;
      role: ApiRole;
      permissions: FeatureKey[];
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    name?: string;
    phone?: string;
    role?: string;
    permissions?: string[];
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: number;
  }
}
