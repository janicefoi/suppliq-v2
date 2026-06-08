"use client";

import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Cell,
} from "recharts";
import type { DailyRevenue } from "@/lib/actions/dashboard";

function fmtK(v: number) {
  if (v >= 1000) return `${(v / 1000).toFixed(0)}k`;
  return String(v);
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-white shadow-sm px-3 py-2 text-xs">
      <p className="text-slate-500 mb-1">{label}</p>
      <p className="font-bold text-slate-900 tabular-nums">
        KES {payload[0].value.toLocaleString("en-KE", { minimumFractionDigits: 2 })}
      </p>
    </div>
  );
}

export function RevenueChart({ data }: { data: DailyRevenue[] }) {
  const today = new Date().toLocaleDateString("en-KE", { weekday: "short", day: "2-digit" })
    .replace(",", "").trim();
  const maxRevenue = Math.max(...data.map((d) => d.revenue), 1);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-slate-700">Revenue — last 7 days</h2>
        <span className="text-[11px] text-slate-400">KES</span>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-4 pt-5">
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={data} barSize={32} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: "#94a3b8" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "#94a3b8" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={fmtK}
              width={32}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "#f8fafc", radius: 4 }} />
            <Bar dataKey="revenue" radius={[4, 4, 0, 0]}>
              {data.map((entry) => (
                <Cell
                  key={entry.label}
                  fill={entry.revenue === maxRevenue ? "#2563eb" : "#bfdbfe"}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
