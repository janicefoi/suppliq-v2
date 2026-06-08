import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getBranches } from "@/lib/actions/branches";
import { BranchesClient } from "@/components/admin/branches-client";

export const metadata = { title: "Branches | JSH ERP" };

export default async function BranchesPage() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") redirect("/dashboard");

  const branches = await getBranches();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Branches</h1>
        <p className="text-sm text-slate-500 mt-0.5">Manage store locations</p>
      </div>
      <BranchesClient branches={branches} />
    </div>
  );
}

