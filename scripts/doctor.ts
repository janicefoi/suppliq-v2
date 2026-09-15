/**
 * Diagnoses why a Suppliq deployment can't sign in.
 *
 * Checks, in the order they break:
 *   1. Required env vars are present and not obviously stale
 *   2. The database is reachable
 *   3. The schema has been applied
 *   4. The demo user exists and its password matches
 *
 * Local:
 *   npm run doctor
 *
 * Against production (PowerShell):
 *   $env:PROD_DATABASE_URL="postgresql://...:5432/postgres"; npm run doctor
 *
 * Against production (bash):
 *   PROD_DATABASE_URL="postgresql://...:5432/postgres" npm run doctor
 */

import { readFileSync, existsSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

// tsx doesn't load .env files, and dotenv isn't a direct dependency. Mirror
// Next.js precedence (.env.local overrides .env) so a local run sees the same
// variables the dev server does. Real environment variables always win.
function loadEnvFiles() {
  // Anything already in the environment was set by the shell and outranks
  // both files — otherwise `PROD_DATABASE_URL=... npm run doctor` would be
  // silently overwritten by .env.local.
  const fromShell = new Set(Object.keys(process.env));

  for (const file of [".env", ".env.local"]) {
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, "utf8").split("\n")) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!match) continue;
      const [, key, rawValue] = match;
      if (fromShell.has(key)) continue;
      // .env.local wins over .env, matching Next.js.
      process.env[key] = rawValue.trim().replace(/^["']|["']$/g, "");
    }
  }
}

function firstLine(err: unknown): string {
  const text = err instanceof Error ? err.message : String(err);
  // Prisma errors lead with blank lines and an echo of the invocation.
  const line = text
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.length > 0 && !l.startsWith("Invalid `"));
  return line ?? text.trim().slice(0, 200);
}

const DEMO_EMAIL = "demo@suppliq.com";
const DEMO_PASSWORD = "demo1234";

let failures = 0;

function pass(msg: string) {
  console.log(`  ✓ ${msg}`);
}
function fail(msg: string, fix: string) {
  failures++;
  console.log(`  ✗ ${msg}`);
  console.log(`    → ${fix}`);
}
function warn(msg: string, note: string) {
  console.log(`  ! ${msg}`);
  console.log(`    → ${note}`);
}

async function main() {
  loadEnvFiles();

  const override = process.env.PROD_DATABASE_URL;
  const url = override ?? process.env.DATABASE_URL;

  console.log(`\nSuppliq deployment doctor — target: ${override ? "REMOTE" : "local (.env)"}\n`);

  console.log("Environment");

  if (!url) {
    fail("No database URL found", "Set DATABASE_URL in .env, or PROD_DATABASE_URL to check a remote DB.");
    console.log("\nCannot continue without a connection string.\n");
    process.exit(1);
  }
  pass(`Database URL present (${url.replace(/:\/\/[^@]*@/, "://***:***@")})`);

  // NextAuth v5 reads AUTH_SECRET. NEXTAUTH_SECRET is the v4 name.
  if (process.env.AUTH_SECRET) {
    pass("AUTH_SECRET is set");
  } else if (process.env.NEXTAUTH_SECRET) {
    warn(
      "AUTH_SECRET is missing; only NEXTAUTH_SECRET is set",
      "Works via the fallback in auth.ts, but set AUTH_SECRET on every deploy target — NextAuth v5 looks for that name."
    );
  } else {
    fail(
      "Neither AUTH_SECRET nor NEXTAUTH_SECRET is set",
      "Generate one with `openssl rand -base64 32` and set AUTH_SECRET. Without it every auth call throws MissingSecret."
    );
  }

  // A localhost AUTH_URL copied into a hosted environment breaks every callback.
  const authUrl = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL;
  if (authUrl && /localhost|127\.0\.0\.1/.test(authUrl) && process.env.VERCEL) {
    fail(
      `AUTH_URL is "${authUrl}" on a Vercel deployment`,
      "Unset AUTH_URL and NEXTAUTH_URL in Vercel — the platform infers its own origin."
    );
  } else if (authUrl) {
    pass(`Auth URL: ${authUrl}`);
  }

  const aiUrl = process.env.AI_SERVICE_URL;
  if (!aiUrl) {
    warn("AI_SERVICE_URL is unset", "AI insight pages will report the service as unavailable.");
  } else if (/localhost|127\.0\.0\.1/.test(aiUrl) && process.env.VERCEL) {
    warn(`AI_SERVICE_URL is "${aiUrl}" on Vercel`, "Point it at the deployed FastAPI service, or AI pages stay empty.");
  } else {
    pass(`AI service: ${aiUrl}`);
  }

  console.log("\nDatabase");

  const prisma = new PrismaClient({
    datasources: { db: { url } },
    log: ["error"],
  });

  try {
    await prisma.$queryRaw`SELECT 1`;
    pass("Connection established");
  } catch (err) {
    fail(
      `Cannot connect: ${firstLine(err)}`,
      "Check the host, port and password. For Supabase, seeding/migrating needs the DIRECT connection (port 5432)."
    );
    await prisma.$disconnect();
    summarise();
    return;
  }

  let userCount: number;
  try {
    userCount = await prisma.user.count();
    pass(`Schema applied (users table present, ${userCount} row${userCount === 1 ? "" : "s"})`);
  } catch (err) {
    const msg = firstLine(err);
    fail(
      `Schema missing or out of date: ${msg}`,
      "Run `npx prisma db push` (or `prisma migrate deploy`) against this database using the DIRECT URL."
    );
    await prisma.$disconnect();
    summarise();
    return;
  }

  console.log("\nDemo account");

  const demo = await prisma.user.findUnique({
    where: { email: DEMO_EMAIL },
    select: { passwordHash: true, isActive: true, organizationId: true },
  });

  if (!demo) {
    fail(
      `${DEMO_EMAIL} does not exist`,
      "Run `npm run db:seed-prod` with PROD_DATABASE_URL pointing at this database."
    );
  } else {
    pass(`${DEMO_EMAIL} exists`);

    if (!demo.isActive) {
      fail("Demo user is deactivated", "authorize() rejects inactive users. Set isActive = true.");
    } else {
      pass("Demo user is active");
    }

    if (await bcrypt.compare(DEMO_PASSWORD, demo.passwordHash)) {
      pass("Demo password matches the one hardcoded in the login page");
    } else {
      fail(
        "Demo password does NOT match",
        "seed.ts upserts with `update: {}`, so an existing row keeps its old password. Reset the hash or delete the user and re-seed."
      );
    }

    const org = await prisma.organization.findUnique({
      where: { id: demo.organizationId },
      select: { plan: true, name: true },
    });
    if (org) {
      pass(`Organisation: ${org.name} (${org.plan})`);
      if (org.plan !== "ENTERPRISE") {
        warn(`Demo org is on ${org.plan}`, "AI insight pages are plan-gated; the demo expects ENTERPRISE.");
      }
    }

    const [items, sales] = await Promise.all([prisma.item.count(), prisma.sale.count()]);
    if (items === 0 || sales === 0) {
      fail(
        `Demo data is thin (${items} items, ${sales} sales)`,
        "Run `npm run db:seed-prod` — the dashboard and AI pages will otherwise render empty."
      );
    } else {
      pass(`Demo data present (${items} items, ${sales} sales)`);
    }
  }

  await prisma.$disconnect();
  summarise();
}

function summarise() {
  if (failures === 0) {
    console.log("\n✓ No blocking problems found.\n");
  } else {
    console.log(`\n✗ ${failures} blocking problem${failures === 1 ? "" : "s"} found — see the → lines above.\n`);
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error("\nDoctor crashed:", e);
  process.exit(1);
});
