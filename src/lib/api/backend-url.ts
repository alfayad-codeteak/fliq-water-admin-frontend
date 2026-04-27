/**
 * Server-side base URL for the Nest (or other) API — no trailing slash.
 * Set `API_URL` in `.env` (e.g. `http://localhost:4000`).
 */
export function getBackendBaseUrl(): string {
  const raw = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL;
  if (!raw) {
    throw new Error(
      "Missing API_URL. Add API_URL=http://localhost:YOUR_PORT to .env"
    );
  }
  return raw.replace(/\/$/, "");
}
