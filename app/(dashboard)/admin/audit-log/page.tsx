import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getAuditLogs } from "@/lib/actions/audit";
import { AuditLogClient } from "@/components/audit/audit-log-client";

export const metadata = { title: "Audit Log | JSH ERP" };

export default async function AuditLogPage() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") redirect("/dashboard");

  const data = await getAuditLogs();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Audit Log</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Track all credit payment recordings and inventory stock-in entries
        </p>
      </div>
      <AuditLogClient data={data} />
    </div>
  );
}

