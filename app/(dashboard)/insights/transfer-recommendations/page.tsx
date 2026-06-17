import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { ai } from "@/lib/ai/client";
import { TransferRecommendationsClient } from "@/components/insights/transfer-recommendations-client";

export const metadata = { title: "Transfer Hints | SUPPLIQ" };

export type TransferRecommendation = {
  item_id: string;
  item_name: string;
  sku: string;
  from_branch_id: string;
  from_branch_name: string;
  from_stock: number;
  from_days_of_cover: number;
  to_branch_id: string;
  to_branch_name: string;
  to_stock: number;
  to_days_of_cover: number | null;
  to_rop: number;
  transfer_qty: number;
  priority: "critical" | "high" | "medium";
  unit_cost: number;
  retail_price: number;
  capital_freed: number;
  reorder_savings: number;
  confidence_score: number;
};

export default async function TransferRecommendationsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (session.user.role === "CASHIER") redirect("/dashboard");

  const orgId = session.user.organizationId;

  const result = await ai.get<{
    recommendations: TransferRecommendation[];
    count: number;
    critical_count: number;
    high_count: number;
    total_capital_freed: number;
    total_reorder_savings: number;
    currency: string;
  }>(`/optimize/transfer-recommendations/${orgId}`);

  const unavailable        = !result.ok && result.unavailable;
  const recommendations    = result.ok ? result.data.recommendations : [];
  const criticalCount      = result.ok ? result.data.critical_count : 0;
  const highCount          = result.ok ? result.data.high_count : 0;
  const totalCapitalFreed  = result.ok ? result.data.total_capital_freed : 0;
  const totalReorderSavings = result.ok ? result.data.total_reorder_savings : 0;
  const currency           = result.ok ? result.data.currency : (session.user.currency ?? "EUR");

  return (
    <TransferRecommendationsClient
      recommendations={recommendations}
      currency={currency}
      criticalCount={criticalCount}
      highCount={highCount}
      totalCapitalFreed={totalCapitalFreed}
      totalReorderSavings={totalReorderSavings}
      unavailable={unavailable}
    />
  );
}
