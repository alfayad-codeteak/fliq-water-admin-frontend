import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { getBackendBaseUrl } from "@/lib/api/backend-url";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    return NextResponse.json({ socketUrl: getBackendBaseUrl() });
  } catch {
    return NextResponse.json({ socketUrl: null }, { status: 200 });
  }
}
