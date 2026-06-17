import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { ai } from "@/lib/ai/client";
import { getSuppliers } from "@/lib/actions/suppliers";
import { getBranches } from "@/lib/actions/branches";
import { ReorderClient } from "@/components/insights/reorder-client";

export const metadata = { title: "Reorder Alerts | SUPPLIQ" };

export type ReorderRecommendation = {
  item_id: string;
  item_name: string;
  sku: string;
  branch_id: string;
  branch_name: string;
  current_stock: number;
  reorder_point: number;
  suggested_order_qty: number;
  estimated_days_until_stockout: number | null;
  avg_daily_demand: number;
  lead_time_days: number;
  priority: "critical" | "high" | "medium" | "low";
  confidence_score: number;
  reasoning: string;
};

export default async function ReorderPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (session.user.role === "CASHIER") redirect("/dashboard");

  const orgId = session.user.organizationId;
  const isAdmin = session.user.role === "ADMIN";

  const [aiResult, suppliers, branches] = await Promise.all([
    ai.get<{ recommendations: ReorderRecommendation[]; count: number; critical_count: number; high_count: number }>(
      `/optimize/reorder/${orgId}`
    ),
    getSuppliers(),
    isAdmin ? getBranches() : Promise.resolve([]),
  ]);

  const unavailable  = !aiResult.ok && aiResult.unavailable;
  const recommendations = aiResult.ok ? aiResult.data.recommendations : [];
  const criticalCount   = aiResult.ok ? aiResult.data.critical_count : 0;
  const highCount       = aiResult.ok ? aiResult.data.high_count : 0;

  return (
    <ReorderClient
      recommendations={recommendations}
      suppliers={suppliers}
      branches={branches}
      currency={session.user.currency ?? "EUR"}
      isAdmin={isAdmin}
      defaultBranchId={session.user.branchId ?? null}
      unavailable={unavailable}
      criticalCount={criticalCount}
      highCount={highCount}
      plan={session.user.plan ?? "STARTER"}
    />
  );
}
