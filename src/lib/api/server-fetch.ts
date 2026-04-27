import { auth } from "@/auth";

import { getBackendBaseUrl } from "./backend-url";

const DEFAULT_TIMEOUT_MS = 15_000;

function mergeWithTimeout(userSignal: AbortSignal | undefined): AbortSignal {
  const timeout = AbortSignal.timeout(DEFAULT_TIMEOUT_MS);
  if (!userSignal) return timeout;
  if (typeof AbortSignal !== "undefined" && "any" in AbortSignal) {
    return AbortSignal.any([userSignal, timeout]);
  }
  return timeout;
}

/** Authenticated server-side fetch to the backend API (`API_URL` + path). */
export async function backendFetch(
  apiPath: string,
  init?: RequestInit
): Promise<Response> {
  const session = await auth();
  if (!session?.accessToken) {
    throw new Error("Unauthorized");
  }
  const path = apiPath.startsWith("/") ? apiPath : `/${apiPath}`;
  const url = `${getBackendBaseUrl()}${path}`;
  const { signal: userSignal, ...restInit } = init ?? {};
  const signal = mergeWithTimeout(userSignal ?? undefined);

  try {
    return await fetch(url, {
      ...restInit,
      signal,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${session.accessToken}`,
        ...init?.headers,
      },
      cache: "no-store",
    });
  } catch (e) {
    console.error("backendFetch failed", apiPath, e);
    return new Response(null, {
      status: 503,
      statusText: "Upstream unavailable",
    });
  }
}
