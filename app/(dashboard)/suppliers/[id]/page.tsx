import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { getSupplierDetail } from "@/lib/actions/suppliers";
import { getBranches } from "@/lib/actions/branches";
import { getPurchasableItems } from "@/lib/actions/inventory";
import { ai } from "@/lib/ai/client";
import { SupplierDetailClient } from "@/components/suppliers/supplier-detail-client";
import type { SupplierScore } from "@/components/suppliers/supplier-score";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const supplier = await getSupplierDetail(id);
  return { title: supplier ? `${supplier.name} | Suppliq` : "Supplier | Suppliq" };
}

export default async function SupplierDetailPage({ params }: Props) {
  const { id } = await params;
  const session = await auth();
  const role = session?.user?.role ?? "CASHIER";
  const isAdmin = role === "ADMIN";
  const orgId = session?.user?.organizationId ?? "";

  const [supplier, allItems, branches, aiScores] = await Promise.all([
    getSupplierDetail(id),
    getPurchasableItems(),
    isAdmin ? getBranches() : Promise.resolve([]),
    ai.get<{ suppliers: SupplierScore[] }>(`/intelligence/supplier-scores/${orgId}`),
  ]);

  if (!supplier) notFound();

  const score = aiScores.ok
    ? (aiScores.data.suppliers.find((s) => s.supplier_id === id) ?? null)
    : null;

  return (
    <SupplierDetailClient
      supplier={supplier}
      role={role}
      branches={branches}
      userBranchId={session?.user?.branchId ?? null}
      currency={session?.user?.currency ?? "EUR"}
      allItems={allItems}
      score={score}
    />
  );
}
