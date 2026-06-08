import { ShoppingCart, AlertTriangle } from "lucide-react";
import { auth } from "@/auth";
import {
  getDashboardMetrics, getRecentSales, getLowStockAlerts,
  getRevenueChart, getTopSellingItems, getTopDebtors, getBranches,
} from "@/lib/actions/dashboard";
import { MetricCard } from "@/components/dashboard/metric-card";
import { LowStockList } from "@/components/dashboard/low-stock-list";
import { BranchDashboard } from "@/components/dashboard/branch-dashboard";

export const metadata = { title: "Dashboard | JSH ERP" };

export default async function DashboardPage() {
  const session = await auth();
  const role = session?.user?.role;
  const isAdmin = role === "ADMIN";
  const branchId = session?.user?.branchId ?? null;

  if (isAdmin) {
    const branches = await getBranches();

    // Fetch combined + per-branch data all in parallel
    const [
      combinedMetrics, combinedSales, combinedLowStock, combinedChart, combinedTopItems, combinedTopDebtors,
      ...rest
    ] = await Promise.all([
      getDashboardMetrics(null),
      getRecentSales(null),
      getLowStockAlerts(null),
      getRevenueChart(null),
      getTopSellingItems(null),
      getTopDebtors(null),
      ...branches.flatMap((b) => [
        getDashboardMetrics(b.id),
        getLowStockAlerts(b.id),
        getRevenueChart(b.id),
        getTopSellingItems(b.id),
        getTopDebtors(b.id),
      ]),
    ]);

    const branchData = branches.map((b, i) => ({
      branch: b,
      metrics:     rest[i * 5 + 0] as Awaited<ReturnType<typeof getDashboardMetrics>>,
      lowStock:    rest[i * 5 + 1] as Awaited<ReturnType<typeof getLowStockAlerts>>,
      chart:       rest[i * 5 + 2] as Awaited<ReturnType<typeof getRevenueChart>>,
      topItems:    rest[i * 5 + 3] as Awaited<ReturnType<typeof getTopSellingItems>>,
      topDebtors:  rest[i * 5 + 4] as Awaited<ReturnType<typeof getTopDebtors>>,
    }));

    return (
      <BranchDashboard
        userName={session?.user?.name ?? ""}
        branches={branches}
        combined={{
          metrics:    combinedMetrics,
          sales:      combinedSales,
          lowStock:   combinedLowStock,
          chart:      combinedChart,
          topItems:   combinedTopItems,
          topDebtors: combinedTopDebtors,
        }}
        branchData={branchData}
      />
    );
  }

  // Non-admin: scoped to their branch
  const [metrics, lowStockAlerts] = await Promise.all([
    getDashboardMetrics(branchId),
    getLowStockAlerts(branchId),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Welcome back, <span className="font-medium text-slate-700">{session?.user?.name}</span>
        </p>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <MetricCard title="Sales today" value={String(metrics.todaySalesCount)} icon={ShoppingCart} color="green" />
        <MetricCard
          title="Low stock items"
          value={String(metrics.lowStockCount)}
          icon={AlertTriangle}
          color={metrics.lowStockCount > 0 ? "amber" : "green"}
          subtitle={metrics.lowStockCount === 0 ? "All stocked up" : "Need restocking"}
        />
      </div>
      <LowStockList items={lowStockAlerts} />
    </div>
  );
}

