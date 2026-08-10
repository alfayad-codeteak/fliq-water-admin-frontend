import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import { getBackendBaseUrl } from "@/lib/api/backend-url";
import { resolveAdminDbGet } from "@/lib/db/admin-reads";
import { isBusinessDbConfigured } from "@/lib/db/business-pool";

export const runtime = "nodejs";

async function proxy(req: NextRequest, pathSegments: string[]) {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const subpath = pathSegments.join("/");
  const first = pathSegments[0];

  if (!first || !["owner", "admin"].includes(first)) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  if (first === "owner" && session.user.role !== "owner") {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  // Fast path: read lists/details straight from Postgres instead of Workers.
  if (req.method === "GET" && isBusinessDbConfigured()) {
    try {
      const result = await resolveAdminDbGet(
        pathSegments,
        req.nextUrl.searchParams
      );
      if (result.handled) {
        return NextResponse.json(result.data, {
          status: result.status ?? 200,
        });
      }
    } catch (e) {
      console.error("BFF DB read failed, proxying to API", subpath, e);
    }
  }

  const target = `${getBackendBaseUrl()}/api/${subpath}${req.nextUrl.search}`;
  const method = req.method;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${session.accessToken}`,
  };
  const contentType = req.headers.get("content-type");
  if (contentType) headers["Content-Type"] = contentType;

  let body: string | undefined;
  if (method !== "GET" && method !== "HEAD") {
    body = await req.text();
  }

  const res = await fetch(target, { method, headers, body, cache: "no-store" });
  const out = new Headers();
  const ct = res.headers.get("content-type");
  if (ct) out.set("content-type", ct);
  return new NextResponse(res.body, { status: res.status, headers: out });
}

type Ctx = { params: Promise<{ path?: string[] }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  const { path = [] } = await ctx.params;
  return proxy(req, path);
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const { path = [] } = await ctx.params;
  return proxy(req, path);
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { path = [] } = await ctx.params;
  return proxy(req, path);
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const { path = [] } = await ctx.params;
  return proxy(req, path);
}

export async function PUT(req: NextRequest, ctx: Ctx) {
  const { path = [] } = await ctx.params;
  return proxy(req, path);
}
