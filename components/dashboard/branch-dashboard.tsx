"use client";

import { useState } from "react";
import { TrendingUp, ShoppingCart, AlertTriangle, CreditCard, BarChart3 } from "lucide-react";
import { MetricCard } from "@/components/dashboard/metric-card";
import { RevenueChart } from "@/components/dashboard/revenue-chart";
import { RecentSalesTable } from "@/components/dashboard/recent-sales-table";
import { LowStockList } from "@/components/dashboard/low-stock-list";
import { TopItems } from "@/components/dashboard/top-items";
import { TopDebtors } from "@/components/dashboard/top-debtors";
import { BranchComparison } from "@/components/dashboard/branch-comparison";
import type {
  DashboardMetrics, DailyRevenue, TopItem, TopDebtor,
  RecentSale, LowStockAlert,
} from "@/lib/actions/dashboard";

function fmtKES(v: number) {
  return `KES ${v.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function pct(current: number, previous: number) {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

interface BranchData {
  branch: { id: string; name: string };
  metrics: DashboardMetrics;
  lowStock: LowStockAlert[];
  chart: DailyRevenue[];
  topItems: TopItem[];
  topDebtors: TopDebtor[];
}

interface Combined {
  metrics: DashboardMetrics;
  sales: RecentSale[];
  lowStock: LowStockAlert[];
  chart: DailyRevenue[];
  topItems: TopItem[];
  topDebtors: TopDebtor[];
}

interface Props {
  userName: string;
  branches: { id: string; name: string }[];
  combined: Combined;
  branchData: BranchData[];
}

export function BranchDashboard({ userName, branches, combined, branchData }: Props) {
  const tabs = ["Combined", ...branches.map((b) => b.name)];
  const [activeTab, setActiveTab] = useState("Combined");

  const isCombined = activeTab === "Combined";
  const active: { metrics: DashboardMetrics; lowStock: LowStockAlert[]; chart: DailyRevenue[]; topItems: TopItem[]; topDebtors: TopDebtor[] } =
    isCombined
      ? combined
      : (branchData.find((b) => b.branch.name === activeTab) ?? combined);

  const m = active.metrics;

  const revenueTrend = { pct: pct(m.todayRevenue, m.yesterdayRevenue), label: "vs yesterday" };
  const salesTrend   = { pct: pct(m.todaySalesCount, m.yesterdaySalesCount), label: "vs yesterday" };

  return (
    <div className="space-y-6">

      {/* ── Header + Branch Tabs ─────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Welcome back, <span className="font-medium text-slate-700">{userName}</span>
          </p>
        </div>
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                activeTab === tab
                  ? "bg-white shadow-sm text-slate-900"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* ── Metric cards ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-1">
          <MetricCard
            title="Today's revenue"
            value={fmtKES(m.todayRevenue)}
            icon={TrendingUp}
            color="blue"
            trend={revenueTrend}
          />
        </div>
        <div className="lg:col-span-1">
          <MetricCard
            title="MTD revenue"
            value={fmtKES(m.mtdRevenue)}
            icon={BarChart3}
            color="blue"
            subtitle={`${m.mtdSalesCount} sales this month`}
          />
        </div>
        <div className="lg:col-span-1">
          <MetricCard
            title="Sales today"
            value={String(m.todaySalesCount)}
            icon={ShoppingCart}
            color="green"
            trend={salesTrend}
          />
        </div>
        <div className="lg:col-span-1">
          <MetricCard
            title="Low stock items"
            value={String(m.lowStockCount)}
            icon={AlertTriangle}
            color={m.lowStockCount > 0 ? "amber" : "green"}
            subtitle={m.lowStockCount === 0 ? "All stocked up" : "Need restocking"}
          />
        </div>
        <div className="lg:col-span-1">
          <MetricCard
            title="Outstanding credit"
            value={fmtKES(m.totalOutstandingCredit)}
            icon={CreditCard}
            color={m.totalOutstandingCredit > 0 ? "red" : "green"}
            subtitle={m.totalOutstandingCredit === 0 ? "No outstanding credit" : undefined}
          />
        </div>
      </div>

      {/* ── Revenue chart + Top debtors ───────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <RevenueChart data={active.chart} />
        </div>
        <div>
          <TopDebtors debtors={active.topDebtors} />
        </div>
      </div>

      {/* ── Top items + Branch comparison (combined) or Low stock (branch) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TopItems items={active.topItems} />
        {isCombined ? (
          <BranchComparison branches={branchData.map((b) => ({ branch: b.branch, metrics: b.metrics }))} />
        ) : (
          <LowStockList items={active.lowStock} />
        )}
      </div>

      {/* ── Recent sales (combined only) ─────────────────────────────────── */}
      {isCombined && <RecentSalesTable sales={combined.sales} isAdmin />}
    </div>
  );
}
