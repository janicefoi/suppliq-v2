import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { ai } from "@/lib/ai/client";
import { AnomaliesClient } from "@/components/insights/anomalies-client";

export const metadata = { title: "Anomaly Alerts | SUPPLIQ" };

export type AnomalyRecord = {
  type: "sales_spike" | "sales_drop" | "stock_shrinkage" | "expense_outlier";
  severity: "critical" | "warning";
  entity_type: "item" | "expense";
  entity_id: string;
  entity_name: string;
  sku: string | null;
  branch_name: string | null;
  description: string;
  suggested_action: string;
  raw_data: Record<string, unknown>;
  detected_at: string;
};

export default async function AnomaliesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (session.user.role === "CASHIER") redirect("/dashboard");

  const orgId = session.user.organizationId;

  const result = await ai.get<{
    anomalies: AnomalyRecord[];
    count: number;
    critical_count: number;
    warning_count: number;
  }>(`/anomalies/${orgId}`);

  const unavailable    = !result.ok && result.unavailable;
  const anomalies      = result.ok ? result.data.anomalies : [];
  const criticalCount  = result.ok ? result.data.critical_count : 0;
  const warningCount   = result.ok ? result.data.warning_count : 0;
  const currency       = session.user.currency ?? "EUR";

  return (
    <AnomaliesClient
      anomalies={anomalies}
      criticalCount={criticalCount}
      warningCount={warningCount}
      currency={currency}
      unavailable={unavailable}
    />
  );
}
