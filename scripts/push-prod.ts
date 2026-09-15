/**
 * Pushes the Prisma schema to the deployment's database.
 *
 * `prisma db push` reads DATABASE_URL / DIRECT_URL from the environment, which
 * locally point at Docker. This resolves the deployment's own unpooled
 * connection string from `.env.production.local` (written by
 * `npx vercel env pull .env.production.local --environment=production`) and
 * passes it to the child process only — nothing is printed and `.env` is left
 * untouched.
 *
 *   npm run db:push-prod
 *
 * Safe to re-run: `db push` is idempotent, converging the database on the
 * schema. It does NOT drop data unless a column or table was removed from
 * schema.prisma.
 */

import { spawnSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";

const ENV_FILE = ".env.production.local";

function fail(message: string): never {
  console.error(`\n✗ ${message}\n`);
  process.exit(1);
}

function readKey(key: string): string | undefined {
  if (!existsSync(ENV_FILE)) return undefined;
  for (const line of readFileSync(ENV_FILE, "utf8").split("\n")) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (match && match[1] === key) {
      return match[2].trim().replace(/^["']|["']$/g, "");
    }
  }
  return undefined;
}

// Schema changes need a real session, so prefer the unpooled connection.
const PREFERENCE = [
  "DIRECT_URL",
  "DATABASE_URL_UNPOOLED",
  "POSTGRES_URL_NON_POOLING",
  "DATABASE_URL",
];

// An explicit PROD_DATABASE_URL always wins. It's the only option when the
// project's variables are stored as Vercel "Secret" type, which `env pull`
// cannot read back — it writes "[SENSITIVE]" placeholders instead.
let url: string | undefined = process.env.PROD_DATABASE_URL;
let usedKey = url ? "PROD_DATABASE_URL" : "";

if (!url) {
  for (const key of PREFERENCE) {
    const value = readKey(key);
    if (value && value !== "[SENSITIVE]") {
      url = value;
      usedKey = key;
      break;
    }
  }
}

if (!url) {
  fail(
    "No usable connection string.\n" +
      `  ${ENV_FILE} has none (Vercel "Secret" variables pull as [SENSITIVE]).\n` +
      "  Copy the database's connection string and set it directly:\n" +
      '    PowerShell:  $env:PROD_DATABASE_URL = "postgresql://..."\n' +
      '    bash:        export PROD_DATABASE_URL="postgresql://..."'
  );
}

// Shell quoting mishaps routinely leave a stray "=", quote, or whitespace on
// the front. Prisma reports that as an opaque P1013 "scheme is not recognized",
// so normalise it here and say plainly what was wrong.
const cleaned = url.trim().replace(/^[=\s'"]+/, "").replace(/['"]+$/, "");
if (cleaned !== url) {
  console.log("! Trimmed stray leading/trailing characters from the connection string.");
  url = cleaned;
}

if (!/^postgres(ql)?:\/\//.test(url)) {
  fail(
    `${usedKey} is not a PostgreSQL connection string.\n` +
      `  It starts with: ${JSON.stringify(url.slice(0, 20))}\n` +
      "  Expected it to start with postgresql:// — check for stray characters\n" +
      "  from shell quoting."
  );
}

if (url.includes("localhost") || url.includes("127.0.0.1")) {
  fail(
    `${usedKey} points at localhost.\n` +
      "  Use `npx prisma db push` directly for the local database."
  );
}

if (url.includes("-pooler.")) {
  console.log(
    "! This is a pooled connection. Schema changes need a direct session —\n" +
      "  if the push fails, remove '-pooler' from the hostname and retry.\n"
  );
}

console.log(`\nPushing schema using ${usedKey} → ${url.replace(/:\/\/[^@]*@/, "://***:***@")}\n`);

const result = spawnSync("npx", ["prisma", "db", "push"], {
  stdio: "inherit",
  shell: true, // required for npx resolution on Windows
  env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url },
});

if (result.status !== 0) {
  fail(`prisma db push failed (exit ${result.status}).`);
}

console.log("\n✓ Schema pushed. Next: npm run db:seed-prod:vercel\n");
