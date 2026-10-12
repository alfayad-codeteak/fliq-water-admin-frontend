const FALLBACK = "Something went wrong. Please try again.";

const NEST_STATUS_LABELS = new Set([
  "conflict",
  "bad request",
  "unauthorized",
  "forbidden",
  "not found",
  "internal server error",
  "payload too large",
]);

function looksLikeRawCode(text: string): boolean {
  const t = text.trim();
  if (!t) return true;
  if (t.startsWith("{") || t.startsWith("[")) return true;
  if (/^HTTP\s+\d{3}$/i.test(t)) return true;
  if (/statusCode|\/api\/|ECONN|TypeError|Prisma|Exception|stack/i.test(t)) {
    return true;
  }
  return NEST_STATUS_LABELS.has(t.toLowerCase());
}

function friendlyForHttpStatus(status?: number): string {
  if (status === 400 || status === 422) return "Please check the details and try again.";
  if (status === 401) return "Please sign in again and try once more.";
  if (status === 403) return "You are not allowed to do that.";
  if (status === 404) return "We could not find that record.";
  if (status === 409) return "This already exists. Please use a different value.";
  if (status === 429) return "Too many attempts. Please wait a moment and try again.";
  if (status && status >= 500) return "The server had a problem. Please try again in a moment.";
  return FALLBACK;
}

/** Plain sentence for staff UI — never JSON, HTTP codes, or Nest `error` labels. */
export function userFacingError(input: unknown, fallback = FALLBACK): string {
  if (input == null) return fallback;
  if (typeof input === "number") return friendlyForHttpStatus(input);

  if (typeof input === "string") {
    const trimmed = input.trim();
    if (!trimmed) return fallback;
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        return userFacingError(JSON.parse(trimmed), fallback);
      } catch {
        return fallback;
      }
    }
    if (looksLikeRawCode(trimmed)) return fallback;
    return trimmed;
  }

  if (Array.isArray(input)) {
    for (const item of input) {
      const msg = userFacingError(item, "");
      if (msg) return msg;
    }
    return fallback;
  }

  if (typeof input === "object") {
    const rec = input as Record<string, unknown>;
    if (rec.message != null) {
      const msg = userFacingError(rec.message, "");
      if (msg) return msg;
    }
    if (Array.isArray(rec.root)) {
      const msg = userFacingError(rec.root, "");
      if (msg) return msg;
    }
    for (const value of Object.values(rec)) {
      if (value === rec.message || value === rec.error || value === rec.statusCode) {
        continue;
      }
      if (Array.isArray(value) && value.length > 0) {
        const msg = userFacingError(value, "");
        if (msg) return msg;
      }
    }
    const status = typeof rec.statusCode === "number" ? rec.statusCode : undefined;
    return friendlyForHttpStatus(status);
  }

  return fallback;
}

export async function userFacingErrorFromResponse(
  res: Response,
  fallback = FALLBACK,
): Promise<string> {
  const text = await res.text();
  const fromBody = userFacingError(text, "");
  if (fromBody) return fromBody;
  return friendlyForHttpStatus(res.status) || fallback;
}
