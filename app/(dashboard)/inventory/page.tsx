import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getItems, getInventoryStats } from "@/lib/actions/inventory";
import { getBranches } from "@/lib/actions/branches";
import { InventoryClient } from "@/components/inventory/inventory-client";

export const metadata = { title: "Inventory | JSH ERP" };

export default async function InventoryPage() {
  const session = await auth();
  const role = session?.user?.role ?? "CASHIER";
  const isAdmin = role === "ADMIN";

  const [items, suppliers, categories, branches, stats] = await Promise.all([
    getItems(undefined, isAdmin ? null : undefined),
    db.supplier.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.category.findMany({ orderBy: { name: "asc" } }),
    isAdmin ? getBranches() : Promise.resolve([]),
    getInventoryStats(isAdmin ? null : undefined),
  ]);

  return (
    <InventoryClient
      initialItems={items}
      initialStats={stats}
      suppliers={suppliers}
      categories={categories}
      userRole={role}
      branches={branches}
    />
  );
}

