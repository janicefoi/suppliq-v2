import { auth } from "@/auth";
import { getSuppliers, getSupplierStats } from "@/lib/actions/suppliers";
import { getBranches } from "@/lib/actions/branches";
import { SuppliersClient } from "@/components/suppliers/suppliers-client";

export const metadata = { title: "Suppliers | Suppliq" };

export default async function SuppliersPage() {
  const session = await auth();
  const role = session?.user?.role ?? "CASHIER";
  const isAdmin = role === "ADMIN";
  const currency = session?.user?.currency ?? "EUR";

  const [suppliers, stats, branches] = await Promise.all([
    getSuppliers(),
    getSupplierStats(),
    isAdmin ? getBranches() : Promise.resolve([]),
  ]);

  return <SuppliersClient suppliers={suppliers} role={role} stats={stats} branches={branches} currency={currency} />;
}

