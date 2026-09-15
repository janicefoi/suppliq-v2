/**
 * Seeds a REMOTE database with the full Meridian Electronics demo dataset.
 *
 * The seed scripts read DATABASE_URL, and Prisma loads that from `.env` — which
 * points at the local Docker Postgres. Running `npm run db:seed` therefore
 * always seeds local, never production. This runner overrides the connection
 * for the child processes only, so the target has to be stated explicitly:
 *
 *   PowerShell:
 *     $env:PROD_DATABASE_URL="postgresql://...:5432/postgres"
 *     npm run db:seed-prod
 *
 *   bash:
 *     PROD_DATABASE_URL="postgresql://...:5432/postgres" npm run db:seed-prod
 *
 * Use the DIRECT connection (port 5432), not the transaction pooler (6543):
 * the seeds run long multi-statement transactions that pgbouncer can't hold.
 *
 * Every script is idempotent (upsert / updateMany), so re-running is safe.
 */

import { spawnSync } from "node:child_process";

// Order matters: each builds on the rows the previous one created.
const SEEDS = [
  "prisma/seed.ts",          // org, branches, users (incl. demo@suppliq.com), items
  "prisma/seed-history.ts",  // Oct 2025 – Mar 2026 trading history
  "prisma/seed-current.ts",  // Apr – Jun 2026 dense weekly data
  "prisma/seed-stocks.ts",   // "right now" stock levels that trigger AI alerts
  "prisma/seed-events.ts",   // transfers, invoices, audit log entries
];

function fail(message: string): never {
  console.error(`\n✗ ${message}\n`);
  process.exit(1);
}

const url = process.env.PROD_DATABASE_URL;

if (!url) {
  fail(
    "PROD_DATABASE_URL is not set.\n" +
      "  Set it to the target database's DIRECT connection string first.\n" +
      "  Refusing to run — otherwise this would silently seed your local DB."
  );
}

if (url.includes("localhost") || url.includes("127.0.0.1")) {
  fail(
    "PROD_DATABASE_URL points at localhost.\n" +
      "  Use `npm run db:seed` for local seeding."
  );
}

// Redact credentials before echoing the target back.
const target = url.replace(/:\/\/[^@]*@/, "://***:***@");
console.log(`\nSeeding: ${target}\n`);

for (const script of SEEDS) {
  console.log(`\n─── ${script} ${"─".repeat(Math.max(0, 50 - script.length))}`);

  const result = spawnSync("npx", ["tsx", script], {
    stdio: "inherit",
    shell: true, // required for npx resolution on Windows
    env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url },
  });

  if (result.status !== 0) {
    fail(`${script} failed (exit ${result.status}). Stopping — later seeds depend on it.`);
  }
}

console.log("\n✓ All seeds applied. Demo login: demo@suppliq.com / demo1234\n");
