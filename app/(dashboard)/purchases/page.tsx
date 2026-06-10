import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getPurchaseOrders, getPOStats } from "@/lib/actions/purchases";
import { getSuppliers } from "@/lib/actions/suppliers";
import { getBranches } from "@/lib/actions/dashboard";
import { PurchasesClient } from "@/components/purchases/purchases-client";

export default async function PurchasesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (session.user.role === "CASHIER") redirect("/dashboard");

  const [orders, stats, suppliers, branches] = await Promise.all([
    getPurchaseOrders(),
    getPOStats(),
    getSuppliers(),
    session.user.role === "ADMIN" ? getBranches() : Promise.resolve([]),
  ]);

  return (
    <div className="p-6">
      <PurchasesClient
        orders={orders}
        stats={stats}
        suppliers={suppliers}
        branches={branches}
        isAdmin={session.user.role === "ADMIN"}
        defaultBranchId={session.user.branchId ?? null}
        currency={session.user.currency ?? "EUR"}
      />
    </div>
  );
}
