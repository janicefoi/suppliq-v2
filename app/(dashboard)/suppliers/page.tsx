import { auth } from "@/auth";
import { getSuppliers, getSupplierStats } from "@/lib/actions/suppliers";
import { getBranches } from "@/lib/actions/branches";
import { ai } from "@/lib/ai/client";
import { SuppliersClient } from "@/components/suppliers/suppliers-client";
import type { SupplierScore } from "@/components/suppliers/supplier-score";

export const metadata = { title: "Suppliers | Suppliq" };

export default async function SuppliersPage() {
  const session = await auth();
  const role = session?.user?.role ?? "CASHIER";
  const isAdmin = role === "ADMIN";
  const currency = session?.user?.currency ?? "EUR";
  const orgId = session?.user?.organizationId ?? "";

  const [suppliers, stats, branches, aiScores] = await Promise.all([
    getSuppliers(),
    getSupplierStats(),
    isAdmin ? getBranches() : Promise.resolve([]),
    ai.get<{ suppliers: SupplierScore[] }>(`/intelligence/supplier-scores/${orgId}`),
  ]);

  const scoreMap: Record<string, SupplierScore> = {};
  if (aiScores.ok) {
    for (const s of aiScores.data.suppliers) scoreMap[s.supplier_id] = s;
  }

  return (
    <SuppliersClient
      suppliers={suppliers}
      role={role}
      stats={stats}
      branches={branches}
      currency={currency}
      scoreMap={scoreMap}
    />
  );
}

