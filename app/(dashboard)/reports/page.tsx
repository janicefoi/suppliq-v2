import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getBranches } from "@/lib/actions/branches";
import { ReportsClient } from "@/components/reports/reports-client";

export const metadata = { title: "Reports | JSH ERP" };

export default async function ReportsPage() {
  const session = await auth();
  const role = session?.user?.role ?? "";
  if (!["ADMIN", "MANAGER"].includes(role)) redirect("/dashboard");

  const branches = role === "ADMIN" ? await getBranches() : [];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Reports</h1>
        <p className="text-sm text-slate-500 mt-0.5">Sales analysis by date range</p>
      </div>
      <ReportsClient role={role} branches={branches} />
    </div>
  );
}

