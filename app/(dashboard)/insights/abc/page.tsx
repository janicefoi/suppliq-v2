import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { ai } from "@/lib/ai/client";
import { AbcAnalysisClient } from "@/components/insights/abc-analysis-client";

export const metadata = { title: "ABC Analysis | SUPPLIQ" };

export type AbcXyzItem = {
  item_id: string;
  item_name: string;
  sku: string;
  category: string;
  revenue: number;
  revenue_pct: number;
  cumulative_revenue_pct: number;
  total_qty_sold: number;
  avg_weekly_demand: number;
  cv: number;
  week_count: number;
  abc_class: "A" | "B" | "C";
  xyz_class: "X" | "Y" | "Z";
  combined_class: string;
  action: string;
  colour: string;
  stock_qty: number;
  stock_value: number;
  rank: number;
};

export type AbcXyzMatrix = Record<string, { count: number; revenue: number }>;
export type ClassCounts = { A: number; B: number; C: number; X: number; Y: number; Z: number };

export default async function AbcAnalysisPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (session.user.role === "CASHIER") redirect("/dashboard");

  const orgId = session.user.organizationId;

  const result = await ai.get<{
    items: AbcXyzItem[];
    matrix: AbcXyzMatrix;
    class_counts: ClassCounts;
    total_revenue: number;
    item_count: number;
    currency: string;
    period_days: number;
  }>(`/analytics/abc-xyz/${orgId}`);

  const unavailable  = !result.ok && result.unavailable;
  const items        = result.ok ? result.data.items : [];
  const matrix       = result.ok ? result.data.matrix : {} as AbcXyzMatrix;
  const classCounts  = result.ok ? result.data.class_counts : { A: 0, B: 0, C: 0, X: 0, Y: 0, Z: 0 };
  const totalRevenue = result.ok ? result.data.total_revenue : 0;
  const itemCount    = result.ok ? result.data.item_count : 0;
  const currency     = result.ok ? result.data.currency : (session.user.currency ?? "EUR");
  const periodDays   = result.ok ? result.data.period_days : 180;

  return (
    <AbcAnalysisClient
      items={items}
      matrix={matrix}
      classCounts={classCounts}
      totalRevenue={totalRevenue}
      itemCount={itemCount}
      currency={currency}
      periodDays={periodDays}
      unavailable={unavailable}
    />
  );
}
