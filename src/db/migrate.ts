/**
 * Migration Runner
 *
 * Applies Drizzle migrations against the PGlite development database.
 * Since drizzle-kit push requires a network driver (pg/postgres),
 * we apply migrations directly via PGlite + Drizzle migrator.
 *
 * Run with: pnpm db:migrate
 */

import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "./schema";

async function runMigrations() {
  console.log("🔄 Running migrations against PGlite (./dev-data)...\n");

  const client = new PGlite("./dev-data");
  const db = drizzle(client, { schema });

  try {
    await migrate(db, { migrationsFolder: "./drizzle" });
    console.log("✅ Migrations completed successfully.");
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

runMigrations();
