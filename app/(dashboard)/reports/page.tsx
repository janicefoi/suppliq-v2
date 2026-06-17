import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getBranches } from "@/lib/actions/branches";
import { ReportTabs } from "@/components/reports/report-tabs";

export const metadata = { title: "Reports | Suppliq" };

export default async function ReportsPage() {
  const session = await auth();
  const role = session?.user?.role ?? "";
  if (!["ADMIN", "MANAGER"].includes(role)) redirect("/dashboard");

  const branches = role === "ADMIN" ? await getBranches() : [];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Reports</h1>
        <p className="text-sm text-slate-500 mt-0.5">Sales history and profit &amp; loss</p>
      </div>
      <ReportTabs
        role={role}
        branches={branches}
        currency={session?.user?.currency ?? "EUR"}
        plan={session?.user?.plan ?? "STARTER"}
      />
    </div>
  );
}
