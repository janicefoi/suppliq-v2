import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getTransfers, getTransferStats } from "@/lib/actions/transfers";
import { getBranches } from "@/lib/actions/dashboard";
import { TransfersClient } from "@/components/transfers/transfers-client";

export default async function TransfersPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (session.user.role === "CASHIER") redirect("/dashboard");

  const [transfers, stats, branches] = await Promise.all([
    getTransfers(),
    getTransferStats(),
    getBranches(),
  ]);

  return (
    <div className="p-6">
      <TransfersClient
        transfers={transfers}
        stats={stats}
        branches={branches}
        defaultBranchId={session.user.branchId ?? null}
      />
    </div>
  );
}
