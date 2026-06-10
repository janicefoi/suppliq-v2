/**
 * Wipes all transactional and reference data for the seed organization.
 * Keeps: the seed org, both branches, and the admin user.
 * Deletes everything else in child-first (FK-safe) order.
 *
 * Run with:  npm run db:reset
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Resetting database…\n");

  // Delete in child-first order to satisfy foreign key constraints.

  const auditLogs        = await prisma.auditLog.deleteMany();
  console.log(`✓ Deleted ${auditLogs.count} audit logs`);

  const forecasts        = await prisma.forecast.deleteMany();
  console.log(`✓ Deleted ${forecasts.count} forecasts`);

  const stockLogs        = await prisma.stockLog.deleteMany();
  console.log(`✓ Deleted ${stockLogs.count} stock logs`);

  const stockTransferItems = await prisma.stockTransferItem.deleteMany();
  console.log(`✓ Deleted ${stockTransferItems.count} stock transfer items`);

  const stockTransfers   = await prisma.stockTransfer.deleteMany();
  console.log(`✓ Deleted ${stockTransfers.count} stock transfers`);

  const expenses         = await prisma.expense.deleteMany();
  console.log(`✓ Deleted ${expenses.count} expenses`);

  const purchaseOrderItems = await prisma.purchaseOrderItem.deleteMany();
  console.log(`✓ Deleted ${purchaseOrderItems.count} purchase order items`);

  const purchaseOrders   = await prisma.purchaseOrder.deleteMany();
  console.log(`✓ Deleted ${purchaseOrders.count} purchase orders`);

  const saleItems        = await prisma.saleItem.deleteMany();
  console.log(`✓ Deleted ${saleItems.count} sale items`);

  const creditPayments   = await prisma.creditPayment.deleteMany();
  console.log(`✓ Deleted ${creditPayments.count} credit payments`);

  const sales            = await prisma.sale.deleteMany();
  console.log(`✓ Deleted ${sales.count} sales`);

  const branchStocks     = await prisma.branchStock.deleteMany();
  console.log(`✓ Deleted ${branchStocks.count} branch stock records`);

  const customers        = await prisma.customer.deleteMany();
  console.log(`✓ Deleted ${customers.count} customers`);

  const items            = await prisma.item.deleteMany();
  console.log(`✓ Deleted ${items.count} items`);

  const categories       = await prisma.category.deleteMany();
  console.log(`✓ Deleted ${categories.count} categories`);

  const suppliers        = await prisma.supplier.deleteMany();
  console.log(`✓ Deleted ${suppliers.count} suppliers`);

  const users = await prisma.user.deleteMany();
  console.log(`✓ Deleted ${users.count} users`);

  const branches = await prisma.branch.deleteMany();
  console.log(`✓ Deleted ${branches.count} branches`);

  const orgs = await prisma.organization.deleteMany();
  console.log(`✓ Deleted ${orgs.count} organizations`);

  console.log("\n✅ Reset complete. Run  npm run db:seed  to re-populate.\n");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
