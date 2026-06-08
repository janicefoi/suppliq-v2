import { TrendingUp, ShoppingCart, AlertTriangle, CreditCard } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DashboardMetrics } from "@/lib/actions/dashboard";

function fmtKES(v: number) {
  return `KES ${v.toLocaleString("en-KE", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

interface BranchStat {
  branch: { id: string; name: string };
  metrics: DashboardMetrics;
}

export function BranchComparison({ branches }: { branches: BranchStat[] }) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-slate-700 mb-3">Branch comparison</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {branches.map(({ branch, metrics }) => (
          <div key={branch.id} className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-sm font-bold text-slate-800 mb-3">{branch.name}</p>
            <div className="space-y-2.5">
              <Row
                icon={TrendingUp}
                label="Today's revenue"
                value={fmtKES(metrics.todayRevenue)}
                valueClass="text-blue-700"
              />
              <Row
                icon={TrendingUp}
                label="MTD revenue"
                value={fmtKES(metrics.mtdRevenue)}
                valueClass="text-slate-700"
              />
              <Row
                icon={ShoppingCart}
                label="Sales today"
                value={String(metrics.todaySalesCount)}
                valueClass="text-slate-700"
              />
              <Row
                icon={AlertTriangle}
                label="Low stock items"
                value={String(metrics.lowStockCount)}
                valueClass={metrics.lowStockCount > 0 ? "text-amber-600" : "text-green-600"}
              />
              <Row
                icon={CreditCard}
                label="Outstanding credit"
                value={fmtKES(metrics.totalOutstandingCredit)}
                valueClass={metrics.totalOutstandingCredit > 0 ? "text-red-600" : "text-green-600"}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Row({ icon: Icon, label, value, valueClass }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  valueClass: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-1.5 text-xs text-slate-500">
        <Icon className="h-3.5 w-3.5 text-slate-300 shrink-0" />
        {label}
      </div>
      <span className={cn("text-xs font-semibold tabular-nums", valueClass)}>{value}</span>
    </div>
  );
}
