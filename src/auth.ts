import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { NextResponse } from "next/server";

import { getBackendBaseUrl } from "@/lib/api/backend-url";
import type { AuthResponseDto, FeatureKey } from "@/lib/api/types";

function clearTokenAuth(token: Record<string, unknown>) {
  delete token.accessToken;
  delete token.refreshToken;
  delete token.expiresAt;
  delete token.id;
  delete token.name;
  delete token.phone;
  delete token.role;
  delete token.permissions;
  token.authError = "refresh_failed";
  return token;
}

/** 10-digit mobile; strips spaces and accepts optional leading 0 or country code 91. */
function normalizeLoginPhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return digits;
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) return digits.slice(1);
  return null;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60,
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        phone: { label: "Phone", type: "text" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const phone = normalizeLoginPhone(
          typeof credentials?.phone === "string" ? credentials.phone : ""
        );
        const password =
          typeof credentials?.password === "string" ? credentials.password : "";
        if (
          !phone ||
          !/^\d{10}$/.test(phone) ||
          password.length < 6
        ) {
          return null;
        }

        let base: string;
        try {
          base = getBackendBaseUrl();
        } catch {
          console.error("API_URL is not configured");
          return null;
        }

        let res: Response;
        try {
          res = await fetch(`${base}/api/auth/login`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            body: JSON.stringify({
              phone,
              password,
            }),
            cache: "no-store",
            signal: AbortSignal.timeout(15_000),
          });
        } catch {
          console.error("Login request failed (network or timeout)");
          return null;
        }

        const bodyText = await res.text();
        if (!res.ok) {
          if (process.env.NODE_ENV === "development") {
            console.error(
              "[auth] POST /api/auth/login not OK",
              res.status,
              bodyText.slice(0, 400),
              `(API_URL=${base})`
            );
          }
          return null;
        }

        let data: AuthResponseDto;
        try {
          data = JSON.parse(bodyText) as AuthResponseDto;
        } catch {
          if (process.env.NODE_ENV === "development") {
            console.error(
              "[auth] login JSON parse failed — is API_URL your Nest API?",
              bodyText.slice(0, 200)
            );
          }
          return null;
        }

        const u = data.user;
        if (
          !u?.id ||
          !data.accessToken ||
          !data.refreshToken ||
          typeof data.expiresIn !== "number"
        ) {
          if (process.env.NODE_ENV === "development") {
            console.error("[auth] login response missing user or tokens");
          }
          return null;
        }
        if (u.role === "customer") return null;

        return {
          id: u.id,
          name: u.name,
          phone: u.phone,
          role: u.role,
          permissions: u.permissions ?? [],
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          expiresIn: data.expiresIn,
        };
      },
    }),
  ],
  callbacks: {
    authorized({ auth: session, request }) {
      const { pathname } = request.nextUrl;
      const hasAuth = Boolean(
        session?.user && (session as { accessToken?: string }).accessToken
      );

      if (pathname.startsWith("/api/auth")) return true;

      if (pathname.startsWith("/api/")) return true;

      if (pathname === "/login") {
        if (hasAuth) {
          return NextResponse.redirect(new URL("/dashboard", request.nextUrl));
        }
        return true;
      }

      if (pathname === "/") return true;

      if (!hasAuth) {
        return NextResponse.redirect(new URL("/login", request.nextUrl));
      }

      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        const u = user as {
          id: string;
          name: string;
          phone: string;
          role: string;
          permissions: string[];
          accessToken: string;
          refreshToken: string;
          expiresIn: number;
        };
        token.id = u.id;
        token.name = u.name;
        token.phone = u.phone;
        token.role = u.role;
        token.permissions = u.permissions;
        token.accessToken = u.accessToken;
        token.refreshToken = u.refreshToken;
        token.expiresAt = Date.now() + (u.expiresIn ?? 900) * 1000;
        return token;
      }

      const refreshToken = token.refreshToken as string | undefined;
      const expiresAt = token.expiresAt as number | undefined;
      if (
        refreshToken &&
        expiresAt &&
        Date.now() > expiresAt - 120_000
      ) {
        try {
          const base = getBackendBaseUrl();
          const res = await fetch(`${base}/api/auth/refresh`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refreshToken }),
            cache: "no-store",
            signal: AbortSignal.timeout(15_000),
          });
          if (res.ok) {
            const data = (await res.json()) as AuthResponseDto;
            token.accessToken = data.accessToken;
            token.refreshToken = data.refreshToken;
            token.expiresAt = Date.now() + (data.expiresIn ?? 900) * 1000;
            delete token.authError;
            if (data.user) {
              token.name = data.user.name;
              token.phone = data.user.phone;
              token.role = data.user.role;
              token.permissions = data.user.permissions ?? [];
            }
          } else {
            return clearTokenAuth(token);
          }
        } catch (e) {
          console.error("Token refresh failed", e);
          return clearTokenAuth(token);
        }
      }

      if (!token.accessToken) {
        return clearTokenAuth(token);
      }
      return token;
    },
    async session({ session, token }) {
      if (!token.accessToken) {
        session.accessToken = "";
        return session;
      }
      if (session.user) {
        session.user.id = token.id as string;
        session.user.name = token.name as string;
        session.user.email = "";
        session.user.phone = token.phone as string;
        session.user.role = token.role as "owner" | "admin" | "customer";
        session.user.permissions =
          (token.permissions as FeatureKey[] | undefined) ?? [];
      }
      session.accessToken = token.accessToken as string;
      return session;
    },
  },
});
