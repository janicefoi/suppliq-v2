import { auth } from "@/auth";
import { getCustomers, getCustomerStats } from "@/lib/actions/customers";
import { getBranches } from "@/lib/actions/branches";
import { CustomersClient } from "@/components/customers/customers-client";

export const metadata = { title: "Customers | JSH ERP" };

export default async function CustomersPage() {
  const session = await auth();
  const role = session?.user?.role ?? "CASHIER";
  const isAdmin = role === "ADMIN";

  const [customers, branches, stats] = await Promise.all([
    getCustomers("ALL"),
    isAdmin ? getBranches() : Promise.resolve([]),
    getCustomerStats(),
  ]);

  return <CustomersClient customers={customers} role={role} branches={branches} initialStats={stats} />;
}

