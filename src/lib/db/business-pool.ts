import { Pool } from "pg";

let pool: Pool | null = null;

/** True when DATABASE_URL points at the Nest/Supabase Postgres (not local SQLite). */
export function isBusinessDbConfigured(): boolean {
  const url = process.env.DATABASE_URL ?? "";
  return (
    url.startsWith("postgresql://") ||
    url.startsWith("postgres://")
  );
}

export function getBusinessPool(): Pool {
  if (!isBusinessDbConfigured()) {
    throw new Error("DATABASE_URL is not a Postgres connection string");
  }
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 8,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });
  }
  return pool;
}
