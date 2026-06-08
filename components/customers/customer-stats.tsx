import { Users, CreditCard, AlertCircle, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CustomerStats } from "@/lib/actions/customers";

function fmtKES(v: number) {
  if (v >= 1_000_000) return `KES ${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `KES ${(v / 1_000).toFixed(0)}K`;
  return `KES ${v.toLocaleString("en-KE", { minimumFractionDigits: 0 })}`;
}

export function CustomerStats({ stats }: { stats: CustomerStats }) {
  const cards = [
    {
      label: "Total customers",
      value: String(stats.total),
      icon: Users,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      label: "Have credit",
      value: String(stats.withCredit),
      icon: AlertCircle,
      color: stats.withCredit > 0 ? "text-red-600" : "text-green-600",
      bg: stats.withCredit > 0 ? "bg-red-50" : "bg-green-50",
    },
    {
      label: "Total outstanding",
      value: fmtKES(stats.totalOutstanding),
      icon: CreditCard,
      color: stats.totalOutstanding > 0 ? "text-red-600" : "text-green-600",
      bg: stats.totalOutstanding > 0 ? "bg-red-50" : "bg-green-50",
    },
    {
      label: "New this month",
      value: String(stats.newThisMonth),
      icon: UserPlus,
      color: "text-slate-700",
      bg: "bg-slate-50",
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
