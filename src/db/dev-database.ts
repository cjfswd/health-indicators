/**
 * PGlite Development Database Setup
 *
 * Creates an in-memory/filesystem-persisted PGlite instance
 * wrapped with Drizzle ORM for development (no Docker required).
 *
 * Data is persisted to ./dev-data/ for session continuity.
 */

import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "./schema";

let clientInstance: PGlite | null = null;

/**
 * Get or create the PGlite client singleton.
 * Persists data to the filesystem at ./dev-data/ so data
 * survives dev server restarts.
 */
export function getPGliteClient(): PGlite {
  if (!clientInstance) {
    clientInstance = new PGlite("./dev-data");
  }
  return clientInstance;
}

/**
 * Get the Drizzle ORM database instance.
 * Uses the PGlite client with full schema for relational queries.
 */
export function getDb() {
  const client = getPGliteClient();
  return drizzle(client, { schema });
}

/** Pre-initialized database instance for convenience */
export const db = getDb();

/** Type alias for the database instance */
export type Database = ReturnType<typeof getDb>;
