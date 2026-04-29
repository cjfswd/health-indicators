/*
 * WHAT IS THIS FILE?
 *
 * It's the entry point for the Express HTTP server when building for production.
 *
 * Learn more about Node.js server integrations here:
 * - https://qwik.dev/docs/deployments/node/
 */
import "dotenv/config";
import { createQwikCity } from "@builder.io/qwik-city/middleware/node";
import qwikCityPlan from "@qwik-city-plan";
import render from "./entry.ssr";
import express from "express";
import compression from "compression";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { readFileSync } from "node:fs";

// Directories
const distDir = join(fileURLToPath(import.meta.url), "..", "..", "dist");
const buildDir = join(distDir, "build");

// Load manifest via fs to avoid Node 22 ESM JSON import issues
const manifest = JSON.parse(readFileSync(join(distDir, "q-manifest.json"), "utf-8"));

// Create the Qwik City express middleware
const { router, notFound } = createQwikCity({
  render,
  qwikCityPlan,
  manifest,
});

// Create the express server
const app = express();

// Enable gzip compression
app.use(compression());

// Static assets with long-term caching
app.use(
  "/build",
  express.static(buildDir, {
    immutable: true,
    maxAge: "1y",
  })
);

// Other static assets (images, etc.)
app.use(express.static(distDir));

// Use Qwik City's router
app.use(router);

// 404 handler
app.use(notFound);

// Start the server
const PORT = process.env.PORT ?? 3000;
app.listen(PORT, () => {
  console.log(`Server started: http://localhost:${PORT}/`);
});
