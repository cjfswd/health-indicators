/**
 * Drizzle Kit Configuration
 *
 * Points to the schema files and the PGlite development database.
 * Used by drizzle-kit commands: generate, push, migrate, studio.
 */

import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: "./dev-data",
  },
});
