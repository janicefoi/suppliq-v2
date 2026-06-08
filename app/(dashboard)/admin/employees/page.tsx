import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getEmployees } from "@/lib/actions/employees";
import { getBranches } from "@/lib/actions/branches";
import { EmployeesClient } from "@/components/admin/employees-client";

export const metadata = { title: "Employees | JSH ERP" };

export default async function EmployeesPage() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") redirect("/dashboard");

  const [employees, branches] = await Promise.all([getEmployees(), getBranches()]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Employees</h1>
        <p className="text-sm text-slate-500 mt-0.5">Manage staff accounts and access</p>
      </div>
      <EmployeesClient employees={employees} currentUserId={session.user.id} branches={branches} />
    </div>
  );
}

