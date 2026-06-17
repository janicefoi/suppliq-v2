"use client";

import { useEffect, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { Loader2, TrendingUp } from "lucide-react";
import { getItemForecastData, type ItemForecastData } from "@/lib/actions/inventory";
import { cn } from "@/lib/utils";

interface Props {
  itemId: string;
  branchId?: string | null;
}

const BAR_COLORS = ["#93c5fd", "#60a5fa", "#3b82f6"]; // 30d → 90d: light to saturated blue

function ConfidencePip({ score }: { score: number }) {
  const colour =
    score >= 75 ? "text-green-600 bg-green-50 border-green-200" :
    score >= 50 ? "text-amber-600 bg-amber-50 border-amber-200" :
                  "text-red-600 bg-red-50 border-red-200";
  return (
    <span className={cn("inline-flex items-center px-1.5 py-0 rounded-full text-[10px] font-semibold border", colour)}>
      {score}% confidence
    </span>
  );
}

function CustomTooltip({ active, payload, label }: {
  active?: boolean; payload?: { value: number }[]; label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-slate-200 bg-white shadow-sm px-2.5 py-1.5 text-[11px]">
      <p className="font-semibold text-slate-700">{label} demand</p>
      <p className="text-blue-600 font-medium">{payload[0].value} units</p>
    </div>
  );
}

export function ForecastMiniPanel({ itemId, branchId }: Props) {
  const [data, setData] = useState<ItemForecastData | null | "loading">("loading");

  useEffect(() => {
    setData("loading");
    getItemForecastData(itemId, branchId)
      .then((d) => setData(d))
      .catch(() => setData(null));
  }, [itemId, branchId]);

  if (data === "loading") {
    return (
      <div className="flex items-center gap-1.5 text-[10px] text-slate-400 py-1.5 px-1">
        <Loader2 className="h-2.5 w-2.5 animate-spin" />
        Loading forecast…
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-[10px] text-slate-300 italic px-1 py-0.5">
        No forecast data — trigger the demand forecast job first.
      </div>
    );
  }

  const chartData = [
    { label: "30d", demand: data.demand30d },
    { label: "60d", demand: data.demand60d },
    { label: "90d", demand: data.demand90d },
  ];

  return (
    <div className="mt-1 rounded-md border border-blue-100 bg-gradient-to-br from-blue-50/60 to-slate-50 px-3 pt-2 pb-2 space-y-1.5">

      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 text-[10px] font-semibold text-blue-600 uppercase tracking-wide">
          <TrendingUp className="h-2.5 w-2.5" />
          AI Demand Forecast
        </div>
        <ConfidencePip score={data.confidenceScore} />
      </div>

      {/* Bar chart */}
      <div className="h-[80px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} barCategoryGap="35%" margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: "#9ca3af" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis hide domain={[0, "auto"]} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(59,130,246,0.06)" }} />
            <Bar dataKey="demand" radius={[3, 3, 0, 0]}>
              {chartData.map((_, i) => (
                <Cell key={i} fill={BAR_COLORS[i]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Stats row */}
      <div className="flex items-center justify-between text-[10px]">
        <span className="text-slate-500">
          Stock covers{" "}
          <span className="font-semibold text-slate-700">
            {data.daysOfStock !== null ? `${data.daysOfStock}d` : "∞"}
          </span>
          {" · "}avg{" "}
          <span className="font-semibold text-slate-700">{data.avgDailyDemand}/day</span>
        </span>
        {data.suggestedOrderQty !== null && data.suggestedOrderQty > 0 && (
          <span className="font-bold text-blue-700">
            Suggested order: {data.suggestedOrderQty} units
          </span>
        )}
        {data.suggestedOrderQty === 0 && (
          <span className="text-green-600 font-medium">Stock covers full 30d demand</span>
        )}
      </div>
    </div>
  );
}
