import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { ai } from "@/lib/ai/client";
import { BriefingClient } from "@/components/insights/briefing-client";
import { canAccess } from "@/lib/plans";
import { UpgradePrompt } from "@/components/insights/upgrade-prompt";

export const metadata = { title: "AI Briefing | SUPPLIQ" };

export type StockoutRisk = {
  item_name: string;
  sku: string;
  branch: string;
  days_left: number;
  stock_qty: number;
};

export type BriefingAnomaly = {
  type: string;
  entity_name: string;
  severity: "critical" | "warning";
  description?: string;
};

export type SupplierWatch = {
  supplier_name: string;
  avg_lead_days: number;
  order_count: number;
};

export default async function BriefingPage({
  searchParams,
}: {
  searchParams: Promise<{ force?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (session.user.role === "CASHIER") redirect("/dashboard");

  if (!canAccess(session.user.plan, "ai_briefing")) {
    return <UpgradePrompt feature="AI Weekly Briefing" requiredPlan="ENTERPRISE" currentPlan={session.user.plan} />;
  }

  const { force } = await searchParams;
  const orgId = session.user.organizationId;

  const result = await ai.get<{
    org_id: string;
    week_start: string;
    prose: string;
    recommendation: string;
    stockout_risks: StockoutRisk[];
    biggest_anomaly: BriefingAnomaly | null;
    supplier_watch: SupplierWatch | null;
    currency: string;
    from_cache: boolean;
    generated_at: string | null;
  }>(`/intelligence/weekly-briefing/${orgId}${force === "1" ? "?force=true" : ""}`);

  const unavailable = !result.ok && result.unavailable;

  return (
    <BriefingClient
      weekStart={result.ok ? result.data.week_start : ""}
      prose={result.ok ? result.data.prose : ""}
      recommendation={result.ok ? result.data.recommendation : ""}
      stockoutRisks={result.ok ? result.data.stockout_risks : []}
      biggestAnomaly={result.ok ? result.data.biggest_anomaly : null}
      supplierWatch={result.ok ? result.data.supplier_watch : null}
      currency={result.ok ? result.data.currency : (session.user.currency ?? "EUR")}
      fromCache={result.ok ? result.data.from_cache : false}
      generatedAt={result.ok ? result.data.generated_at : null}
      unavailable={unavailable}
    />
  );
}
