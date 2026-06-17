import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { ai } from "@/lib/ai/client";
import { OverstockClient } from "@/components/insights/overstock-client";
import { canAccess } from "@/lib/plans";
import { UpgradePrompt } from "@/components/insights/upgrade-prompt";

export const metadata = { title: "Overstock | SUPPLIQ" };

export type OverstockTransferSuggestion = {
  to_branch_id: string;
  to_branch_name: string;
  transfer_qty: number;
  dest_current_stock: number;
  dest_days_of_cover: number | null;
};

export type OverstockItem = {
  item_id: string;
  item_name: string;
  sku: string;
  branch_id: string;
  branch_name: string;
  current_stock: number;
  avg_daily_demand: number;
  days_of_cover: number;
  excess_units: number;
  capital_tied: number;
  unit_cost: number;
  retail_price: number;
  turnover_rate: number;
  severity: "severe" | "high" | "medium";
  confidence_score: number;
  markdown_suggestion: {
    discount_pct: number;
    current_price: number;
    suggested_price: number;
  };
  transfer_suggestion: OverstockTransferSuggestion | null;
};

export default async function OverstockPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (session.user.role === "CASHIER") redirect("/dashboard");

  if (!canAccess(session.user.plan, "ai_overstock")) {
    return <UpgradePrompt feature="Overstock Analysis" requiredPlan="ENTERPRISE" currentPlan={session.user.plan} />;
  }

  const orgId   = session.user.organizationId;
  const isAdmin = session.user.role === "ADMIN";

  const result = await ai.get<{
    overstock_items: OverstockItem[];
    count: number;
    severe_count: number;
    high_count: number;
    total_capital_tied: number;
    currency: string;
  }>(`/optimize/overstock/${orgId}`);

  const unavailable      = !result.ok && result.unavailable;
  const items            = result.ok ? result.data.overstock_items : [];
  const severeCount      = result.ok ? result.data.severe_count : 0;
  const highCount        = result.ok ? result.data.high_count : 0;
  const totalCapitalTied = result.ok ? result.data.total_capital_tied : 0;
  const currency         = result.ok ? result.data.currency : (session.user.currency ?? "EUR");

  return (
    <OverstockClient
      items={items}
      currency={currency}
      totalCapitalTied={totalCapitalTied}
      severeCount={severeCount}
      highCount={highCount}
      unavailable={unavailable}
      isAdmin={isAdmin}
    />
  );
}
