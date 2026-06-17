import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { ai } from "@/lib/ai/client";
import { CashFlowClient } from "@/components/insights/cash-flow-client";
import { canAccess } from "@/lib/plans";
import { UpgradePrompt } from "@/components/insights/upgrade-prompt";

export const metadata = { title: "Cash Flow | SUPPLIQ" };

export type DailyPoint = {
  day: number;
  date: string;
  revenue: number;
  expenses: number;
  purchases: number;
  net: number;
  cumulative: number;
};

export type PurchaseItem = {
  item_id: string;
  item_name: string;
  sku: string;
  branch_name: string;
  stock_qty: number;
  reorder_point: number;
  est_order_qty: number;
  unit_cost: number;
  est_total_cost: number;
};

export type ExpenseCategory = {
  category: string;
  total: number;
};

export default async function CashFlowPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (session.user.role === "CASHIER") redirect("/dashboard");

  if (!canAccess(session.user.plan, "ai_cash_flow")) {
    return <UpgradePrompt feature="Cash Flow Projection" requiredPlan="ENTERPRISE" currentPlan={session.user.plan} />;
  }

  const orgId = session.user.organizationId;

  const result = await ai.get<{
    currency: string;
    projected_revenue_30d: number;
    projected_expenses_30d: number;
    projected_purchases_30d: number;
    net_cash_30d: number;
    revenue_method: "forecast" | "rolling_avg";
    forecast_confidence: number;
    commentary: string;
    expense_breakdown: ExpenseCategory[];
    purchase_breakdown: PurchaseItem[];
    daily_timeline: DailyPoint[];
    recent_revenue_days: number;
  }>(`/forecast/cash-flow/${orgId}`);

  const unavailable = !result.ok && result.unavailable;

  if (!result.ok && !unavailable) {
    // AI service returned an error response — surface empty state
  }

  return (
    <CashFlowClient
      currency={result.ok ? result.data.currency : (session.user.currency ?? "EUR")}
      projectedRevenue={result.ok ? result.data.projected_revenue_30d : 0}
      projectedExpenses={result.ok ? result.data.projected_expenses_30d : 0}
      projectedPurchases={result.ok ? result.data.projected_purchases_30d : 0}
      netCash={result.ok ? result.data.net_cash_30d : 0}
      revenueMethod={result.ok ? result.data.revenue_method : "rolling_avg"}
      forecastConfidence={result.ok ? result.data.forecast_confidence : 0}
      commentary={result.ok ? result.data.commentary : ""}
      expenseBreakdown={result.ok ? result.data.expense_breakdown : []}
      purchaseBreakdown={result.ok ? result.data.purchase_breakdown : []}
      dailyTimeline={result.ok ? result.data.daily_timeline : []}
      recentRevenueDays={result.ok ? result.data.recent_revenue_days : 0}
      unavailable={unavailable}
    />
  );
}
