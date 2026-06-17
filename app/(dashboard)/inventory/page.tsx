import { auth } from "@/auth";
import { getItems, getInventoryStats, getCategories, getStockoutRisks } from "@/lib/actions/inventory";
import { getSuppliers } from "@/lib/actions/suppliers";
import { getBranches } from "@/lib/actions/branches";
import { InventoryClient } from "@/components/inventory/inventory-client";

export const metadata = { title: "Inventory | JSH ERP" };

export default async function InventoryPage() {
  const session = await auth();
  const role = session?.user?.role ?? "CASHIER";
  const isAdmin = role === "ADMIN";

  const [items, suppliers, categories, branches, stats, riskScores] = await Promise.all([
    getItems(undefined, isAdmin ? null : undefined),
    getSuppliers(),
    getCategories(),
    isAdmin ? getBranches() : Promise.resolve([]),
    getInventoryStats(isAdmin ? null : undefined),
    getStockoutRisks(isAdmin ? null : undefined),
  ]);

  return (
    <InventoryClient
      initialItems={items}
      initialStats={stats}
      suppliers={suppliers}
      categories={categories}
      userRole={role}
      branches={branches}
      currency={session?.user?.currency ?? "EUR"}
      initialRiskScores={riskScores}
    />
  );
}

