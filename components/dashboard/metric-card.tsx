import type { LucideIcon } from "lucide-react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface MetricCardProps {
  title: string;
  value: string;
  icon: LucideIcon;
  color: "blue" | "green" | "amber" | "red";
  subtitle?: string;
  trend?: { pct: number; label: string } | null;
}

const colorMap = {
  blue:  { iconBg: "bg-blue-100",  iconText: "text-blue-600"  },
  green: { iconBg: "bg-green-100", iconText: "text-green-600" },
  amber: { iconBg: "bg-amber-100", iconText: "text-amber-600" },
  red:   { iconBg: "bg-red-100",   iconText: "text-red-600"   },
};

export function MetricCard({ title, value, icon: Icon, color, subtitle, trend }: MetricCardProps) {
  const c = colorMap[color];

  const trendUp   = trend && trend.pct > 0;
  const trendDown = trend && trend.pct < 0;
  const trendFlat = trend && trend.pct === 0;

  return (
    <div className="rounded-xl bg-white border border-slate-200 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
            {title}
          </p>
          <p className="text-2xl font-bold text-slate-900 mt-1 tabular-nums leading-tight">
            {value}
          </p>

          {trend ? (
            <div className={cn(
              "inline-flex items-center gap-1 mt-1 text-[11px] font-medium",
              trendUp   ? "text-green-600" :
              trendDown ? "text-red-500" :
                          "text-slate-400"
            )}>
              {trendUp   && <TrendingUp   className="h-3 w-3" />}
              {trendDown && <TrendingDown className="h-3 w-3" />}
              {trendFlat && <Minus        className="h-3 w-3" />}
              <span>
                {trendFlat ? "No change" : `${trendUp ? "+" : ""}${trend.pct.toFixed(0)}%`}
                {" "}<span className="text-slate-400 font-normal">{trend.label}</span>
              </span>
            </div>
          ) : subtitle ? (
            <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>
          ) : null}
        </div>
        <div className={cn("rounded-xl p-2.5 shrink-0", c.iconBg)}>
          <Icon className={cn("h-5 w-5", c.iconText)} />
        </div>
      </div>
    </div>
  );
}
