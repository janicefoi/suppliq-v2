import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.$transaction(async (tx) => {
    const seedIds = ["seed-branch-001", "seed-branch-002"];

    // Delete related records first to satisfy foreign keys
    await tx.branchStock.deleteMany({ where: { branchId: { in: seedIds } } });
    await tx.stockLog.deleteMany({ where: { branchId: { in: seedIds } } });
    await tx.purchaseOrder.deleteMany({ where: { branchId: { in: seedIds } } });
    await tx.sale.deleteMany({ where: { branchId: { in: seedIds } } });
    await tx.customer.updateMany({ where: { branchId: { in: seedIds } }, data: { branchId: null } });
    await tx.user.updateMany({ where: { branchId: { in: seedIds } }, data: { branchId: null } });

    // Now safe to delete the empty seed branches
    await tx.branch.deleteMany({ where: { id: { in: seedIds } } });

    // Rename the real branches that hold all the data
    await tx.branch.updateMany({
      where: { name: "Branch 1" },
      data: { name: "Mukai Branch" },
    });
    await tx.branch.updateMany({
      where: { name: "Branch 2" },
      data: { name: "Zulu Arcade Branch" },
    });
  });

  console.log("✓ Branch 1 → Mukai Branch");
  console.log("✓ Branch 2 → Zulu Arcade Branch");
  console.log("✓ Empty seed branches removed");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
