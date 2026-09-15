/**
 * Rolls the seeded demo data forward so it always ends "today".
 *
 * The seed scripts contain hard-coded dates (the newest sale is 17 Jun 2026).
 * Every day that passes, the demo looks staler: the dashboard's headline
 * metrics — today's revenue, MTD revenue, sales today, top sellers this week —
 * all read zero, and the AI insight pages have no recent demand to forecast
 * from. This shifts every timestamp in the database by a whole number of days
 * so the most recent sale lands on today.
 *
 * Local:
 *   npm run db:shift-dates
 *
 * Production (PowerShell, in a window where the variable is set):
 *   $env:PROD_DATABASE_URL = 'postgresql://...'
 *   npm run db:shift-dates
 *
 * Idempotent: once the newest sale is today the offset is zero and it does
 * nothing, so it is safe to run on a schedule or before every demo.
 *
 * Whole-day shifts preserve time-of-day (09:00 sales stay morning sales) but
 * move data to different weekdays. That trade is deliberate — a recruiter
 * notices £0.00 at the top of the dashboard; nobody notices that a busy
 * Tuesday became a Thursday.
 */

import { readFileSync, existsSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

function loadEnvFiles() {
  const fromShell = new Set(Object.keys(process.env));
  for (const file of [".env", ".env.local"]) {
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, "utf8").split("\n")) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!match) continue;
      const [, key, rawValue] = match;
      if (fromShell.has(key)) continue;
      process.env[key] = rawValue.trim().replace(/^["']|["']$/g, "");
    }
  }
}

// Tables Prisma owns but that carry no demo data worth moving.
const SKIP_TABLES = new Set(["_prisma_migrations"]);

async function main() {
  loadEnvFiles();

  const raw = process.env.PROD_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!raw) {
    console.error("\n✗ No database URL. Set DATABASE_URL in .env, or PROD_DATABASE_URL for a remote database.\n");
    process.exit(1);
  }
  // Tolerate the stray characters shell quoting tends to leave behind.
  const url = raw.trim().replace(/^[=\s'"]+/, "").replace(/['"]+$/, "");

  const isRemote = !/localhost|127\.0\.0\.1/.test(url);
  console.log(
    `\nShifting demo dates — target: ${isRemote ? "REMOTE" : "local"} ` +
      `(${url.replace(/:\/\/[^@]*@/, "://***:***@")})\n`
  );

  const prisma = new PrismaClient({ datasources: { db: { url } }, log: ["error"] });

  try {
    // Anchor on sales: they drive every time-sensitive widget on the dashboard.
    const [anchor] = await prisma.$queryRawUnsafe<{ offset_days: number | null }[]>(
      `SELECT (CURRENT_DATE - MAX("createdAt")::date)::int AS offset_days FROM sales`
    );

    const offsetDays = anchor?.offset_days ?? null;

    if (offsetDays === null) {
      console.log("No sales found — nothing to shift. Seed the database first.\n");
      return;
    }

    if (offsetDays === 0) {
      console.log("✓ Already current — the newest sale is today. Nothing to do.\n");
      return;
    }

    if (offsetDays < 0) {
      console.log(
        `! The newest sale is ${Math.abs(offsetDays)} day(s) in the future.\n` +
          "  Refusing to shift backwards — that would usually mean the wrong database.\n"
      );
      return;
    }

    // Interpolated below rather than bound as a parameter, so assert it really
    // is a plain integer. It comes from a ::int cast, but this makes the
    // no-injection argument local and obvious.
    if (!Number.isSafeInteger(offsetDays)) {
      throw new Error(`Computed offset is not an integer: ${String(offsetDays)}`);
    }

    console.log(`Newest sale is ${offsetDays} day(s) old. Shifting everything forward by ${offsetDays}.\n`);

    // Discover every date/timestamp column rather than hard-coding a list, so
    // this keeps working when the schema gains new models.
    const columns = await prisma.$queryRawUnsafe<{ table_name: string; column_name: string }[]>(
      `SELECT c.table_name, c.column_name
         FROM information_schema.columns c
         JOIN information_schema.tables t
           ON t.table_schema = c.table_schema AND t.table_name = c.table_name
        WHERE c.table_schema = 'public'
          AND t.table_type = 'BASE TABLE'
          AND c.data_type IN ('timestamp without time zone', 'timestamp with time zone', 'date')
        ORDER BY c.table_name, c.column_name`
    );

    const targets = columns.filter((c) => !SKIP_TABLES.has(c.table_name));
    if (targets.length === 0) {
      console.log("No date columns found — is the schema applied?\n");
      return;
    }

    let totalRows = 0;
    const touched: string[] = [];

    await prisma.$transaction(
      async (tx) => {
        for (const { table_name, column_name } of targets) {
          // Identifiers come from information_schema, not user input; quote them
          // anyway so mixed-case Prisma column names resolve correctly.
          const table = `"${table_name.replace(/"/g, '""')}"`;
          const column = `"${column_name.replace(/"/g, '""')}"`;

          const rows = await tx.$executeRawUnsafe(
            `UPDATE ${table} SET ${column} = ${column} + INTERVAL '${offsetDays} days' WHERE ${column} IS NOT NULL`
          );

          if (rows > 0) {
            totalRows += rows;
            touched.push(`${table_name}.${column_name} (${rows})`);
          }
        }

        // Receipt and PO numbers embed the date they were issued on
        // (RCP-20260617-0006). Left alone they would contradict the row's own
        // createdAt.
        //
        // Two passes are required. Both columns carry a UNIQUE constraint that
        // Postgres enforces row by row, not at commit, so renaming in place
        // collides: a sale moving onto 9 June claims RCP-20260609-0001 while
        // the sale that was already there still holds it. Parking every row on
        // a guaranteed-unique temporary value first removes the overlap.
        //
        // The sequence is regenerated from the new ordering rather than reused,
        // which makes the result unique by construction instead of relying on
        // the old numbering being consistent with createdAt.
        for (const [table, column, prefix] of [
          ["sales", "receiptNumber", "RCP"],
          ["purchase_orders", "poNumber", "PO"],
        ] as const) {
          await tx.$executeRawUnsafe(
            `UPDATE ${table} SET "${column}" = 'TMP-' || id`
          );

          const renamed = await tx.$executeRawUnsafe(
            `WITH numbered AS (
               SELECT id,
                      '${prefix}-' || to_char("createdAt", 'YYYYMMDD') || '-' ||
                      lpad(
                        (row_number() OVER (
                           PARTITION BY "organizationId", ("createdAt")::date
                           ORDER BY "createdAt", id
                         ))::text, 4, '0'
                      ) AS new_number
                 FROM ${table}
             )
             UPDATE ${table} t
                SET "${column}" = n.new_number
               FROM numbered n
              WHERE t.id = n.id`
          );

          if (renamed > 0) touched.push(`${table}.${column} (${renamed})`);
        }
      },
      { timeout: 120_000, maxWait: 15_000 }
    );

    for (const line of touched) console.log(`  ✓ ${line}`);

    console.log(
      `\n✓ Shifted ${totalRows} timestamps across ${touched.length} columns by ${offsetDays} days.` +
        "\n  The newest sale is now today.\n"
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error("\n✗ Date shift failed:", e);
  process.exit(1);
});
