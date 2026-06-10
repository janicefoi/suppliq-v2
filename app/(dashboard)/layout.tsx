import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getLowStockCount } from "@/lib/actions/dashboard";
import { DashboardShell } from "@/components/layout/dashboard-shell";

export default async function DashboardGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const branchId = session.user.role === "ADMIN" ? null : (session.user.branchId ?? null);
  const lowStockCount = await getLowStockCount(branchId);

  return (
    <DashboardShell
      user={session.user}
      isDemo={session.user.isDemo}
      lowStockCount={lowStockCount}
    >
      {children}
    </DashboardShell>
  );
}
