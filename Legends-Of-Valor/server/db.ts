import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const isProduction = process.env.NODE_ENV === "production";

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isProduction ? { rejectUnauthorized: false } : false,
  max: 20,                    // cap concurrent connections
  idleTimeoutMillis: 30_000,  // close idle connections after 30 s
  connectionTimeoutMillis: 5_000, // fail-fast if pool exhausted
});

export const db = drizzle(pool, { schema });
