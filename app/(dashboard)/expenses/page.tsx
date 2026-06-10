import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getExpenses, getExpenseStats } from "@/lib/actions/expenses";
import { getBranches } from "@/lib/actions/dashboard";
import { ExpensesClient } from "@/components/expenses/expenses-client";

export default async function ExpensesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (session.user.role === "CASHIER") redirect("/dashboard");

  const [expenses, stats, branches] = await Promise.all([
    getExpenses(),
    getExpenseStats(),
    getBranches(),
  ]);

  return (
    <div className="p-6">
      <ExpensesClient
        expenses={expenses}
        stats={stats}
        branches={branches}
        defaultBranchId={session.user.branchId ?? null}
        isAdmin={session.user.role === "ADMIN"}
        currency={session.user.currency ?? "EUR"}
      />
    </div>
  );
}
