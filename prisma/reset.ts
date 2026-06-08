/**
 * Wipes all transactional and reference data from the database.
 * Keeps: the admin user + both branches.
 * Deletes: all other users, sales, customers, items, suppliers,
 *          categories, stock logs, purchase orders, credit payments.
 *
 * Run with:  npm run db:reset
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Resetting database…\n");

  // ── Delete in child-first order to satisfy foreign keys ───────────────────

  const saleItems      = await prisma.saleItem.deleteMany();
  console.log(`✓ Deleted ${saleItems.count} sale items`);

  const creditPayments = await prisma.creditPayment.deleteMany();
  console.log(`✓ Deleted ${creditPayments.count} credit payments`);

  const stockLogs      = await prisma.stockLog.deleteMany();
  console.log(`✓ Deleted ${stockLogs.count} stock logs`);

  const purchaseOrders = await prisma.purchaseOrder.deleteMany();
  console.log(`✓ Deleted ${purchaseOrders.count} purchase orders`);

  const sales          = await prisma.sale.deleteMany();
  console.log(`✓ Deleted ${sales.count} sales`);

  const branchStocks   = await prisma.branchStock.deleteMany();
  console.log(`✓ Deleted ${branchStocks.count} branch stock records`);

  const customers      = await prisma.customer.deleteMany();
  console.log(`✓ Deleted ${customers.count} customers`);

  const items          = await prisma.item.deleteMany();
  console.log(`✓ Deleted ${items.count} items`);

  const categories     = await prisma.category.deleteMany();
  console.log(`✓ Deleted ${categories.count} categories`);

  const suppliers      = await prisma.supplier.deleteMany();
  console.log(`✓ Deleted ${suppliers.count} suppliers`);

  // Delete all users except the admin
  const users = await prisma.user.deleteMany({
    where: { email: { not: "admin@jsh.co.ke" } },
  });
  console.log(`✓ Deleted ${users.count} users  (admin@jsh.co.ke kept)`);

  // Branches are intentionally kept — they hold real location data
  const branchCount = await prisma.branch.count();
  console.log(`✓ Branches kept (${branchCount})`);

  console.log("\n✅ Reset complete. Run  npm run db:seed  to re-populate with fresh data.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
