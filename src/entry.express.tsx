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

// Directories
const distDir = join(fileURLToPath(import.meta.url), "..", "..", "dist");
const buildDir = join(distDir, "build");

// Create the Qwik City express middleware
const { router, notFound } = createQwikCity({
  render,
  qwikCityPlan,
  manifest: (await import(join(distDir, "q-manifest.json"), { with: { type: "json" } })).default,
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
