import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import { getBackendBaseUrl } from "@/lib/api/backend-url";
import { pickCustomerDisplayName } from "@/lib/customers/display-name";
import { resolveAdminDbGet } from "@/lib/db/admin-reads";
import { isBusinessDbConfigured } from "@/lib/db/business-pool";

function rewriteAdminCustomersPayload(
  pathSegments: string[],
  payload: unknown,
): unknown {
  const [scope, resource] = pathSegments;
  if (scope !== "admin" || resource !== "customers") return payload;
  if (!payload || typeof payload !== "object") return payload;
  const obj = payload as Record<string, unknown>;
  if (Array.isArray(obj.data)) {
    return {
      ...obj,
      data: obj.data.map((row) => {
        if (!row || typeof row !== "object") return row;
        const record = row as Record<string, unknown>;
        return { ...record, name: pickCustomerDisplayName(record) };
      }),
    };
  }
  return { ...obj, name: pickCustomerDisplayName(obj) };
}

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

  let body: BodyInit | undefined;
  if (method !== "GET" && method !== "HEAD") {
    if (contentType?.includes("multipart/form-data")) {
      body = await req.arrayBuffer();
    } else {
      body = await req.text();
    }
  }

  const res = await fetch(target, { method, headers, body, cache: "no-store" });
  const ct = res.headers.get("content-type");
  if (
    req.method === "GET" &&
    pathSegments[0] === "admin" &&
    pathSegments[1] === "customers" &&
    ct?.includes("application/json")
  ) {
    const payload = rewriteAdminCustomersPayload(
      pathSegments,
      await res.json(),
    );
    return NextResponse.json(payload, { status: res.status });
  }

  const out = new Headers();
  if (ct) out.set("content-type", ct);
  const cache = res.headers.get("cache-control");
  if (cache) out.set("cache-control", cache);
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
