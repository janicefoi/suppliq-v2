import { Truck, Package, ClipboardList, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SupplierStats } from "@/lib/actions/suppliers";

function fmtKES(v: number) {
  if (v >= 1_000_000) return `KES ${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `KES ${(v / 1_000).toFixed(0)}K`;
  return `KES ${v.toLocaleString("en-KE", { minimumFractionDigits: 0 })}`;
}

export function SupplierStats({ stats }: { stats: SupplierStats }) {
  const cards = [
    {
      label: "Total suppliers",
      value: String(stats.total),
      icon: Truck,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      label: "Items supplied",
      value: String(stats.totalItems),
      icon: Package,
      color: "text-slate-700",
      bg: "bg-slate-50",
    },
    {
      label: "Purchase orders",
      value: String(stats.totalOrders),
      icon: ClipboardList,
      color: "text-slate-700",
      bg: "bg-slate-50",
    },
    {
      label: "Total spend",
      value: fmtKES(stats.totalSpend),
      icon: TrendingDown,
      color: "text-amber-600",
      bg: "bg-amber-50",
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {cards.map(({ label, value, icon: Icon, color, bg }) => (
        <div key={label} className="rounded-xl border border-slate-200 bg-white px-4 py-3 flex items-center gap-3">
          <div className={cn("rounded-lg p-2 shrink-0", bg)}>
            <Icon className={cn("h-4 w-4", color)} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide truncate">{label}</p>
            <p className={cn("text-lg font-bold tabular-nums leading-tight", color)}>{value}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
