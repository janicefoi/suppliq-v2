import type { LucideIcon } from "lucide-react";
import { TrendingUp, TrendingDown } from "lucide-react";
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
  blue:  { iconBg: "bg-blue-50",  iconText: "text-blue-600"  },
  green: { iconBg: "bg-green-50", iconText: "text-green-600" },
  amber: { iconBg: "bg-amber-50", iconText: "text-amber-600" },
  red:   { iconBg: "bg-red-50",   iconText: "text-red-600"   },
};

export function MetricCard({ title, value, icon: Icon, color, subtitle, trend }: MetricCardProps) {
  const c = colorMap[color];

  const trendUp   = trend && trend.pct > 0;
  const trendDown = trend && trend.pct < 0;

  return (
    // h-full + flex column so every card in the row is the same height and the
    // footer line sits on a shared baseline, regardless of whether the title
    // wraps to two lines ("Outstanding credit" does, "Sales today" doesn't).
    <div className="flex h-full flex-col rounded-xl border border-slate-200 bg-white p-5">
      {/* Title and icon share the top row so the value below gets the card's
          full width. Previously the value competed with the icon for space and
          long amounts overflowed the card. */}
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
          {title}
        </p>
        <div className={cn("shrink-0 rounded-lg p-2", c.iconBg)}>
          <Icon className={cn("h-4 w-4", c.iconText)} />
        </div>
      </div>

      <p className="mt-2 text-xl font-bold leading-tight tracking-tight text-slate-900 tabular-nums xl:text-2xl">
        {value}
      </p>

      <div className="mt-auto pt-2">
        {trend ? (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium",
              trendUp   ? "bg-green-50 text-green-700" :
              trendDown ? "bg-red-50 text-red-600" :
                          "bg-slate-100 text-slate-500"
            )}
          >
            {trendUp   && <TrendingUp   className="h-3 w-3" aria-hidden />}
            {trendDown && <TrendingDown className="h-3 w-3" aria-hidden />}
            {/* The flat state previously rendered a Minus icon, which at 12px
                read as a stray dash rather than a deliberate indicator. */}
            {trendUp || trendDown ? `${trendUp ? "+" : ""}${trend.pct.toFixed(0)}%` : "No change"}
          </span>
        ) : null}

        {trend ? (
          <span className="ml-1.5 text-[11px] text-slate-400">{trend.label}</span>
        ) : subtitle ? (
          <p className="text-xs text-slate-400">{subtitle}</p>
        ) : null}
      </div>
    </div>
  );
}
