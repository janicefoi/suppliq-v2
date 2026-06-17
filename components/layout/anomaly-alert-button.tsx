"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ShieldAlert, AlertTriangle, AlertCircle, CheckCircle2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type AnomalyPreview = {
  type: string;
  severity: "critical" | "warning";
  entity_name: string;
  branch_name: string | null;
};

const TYPE_LABEL: Record<string, string> = {
  sales_spike:     "Sales spike",
  sales_drop:      "Sales drop",
  stock_shrinkage: "Stock shrinkage",
  expense_outlier: "Expense outlier",
};

export function AnomalyAlertButton() {
  const [total,    setTotal]   = useState(0);
  const [critical, setCritical] = useState(0);
  const [preview,  setPreview] = useState<AnomalyPreview[]>([]);
  const [open,     setOpen]    = useState(false);
  const [loaded,   setLoaded]  = useState(false);

  useEffect(() => {
    fetch("/api/anomalies/count")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (!d) return;
        setTotal(d.total ?? 0);
        setCritical(d.critical ?? 0);
        setPreview(d.preview ?? []);
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  if (!loaded || total === 0) {
    return (
      <button
        className="relative p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
        aria-label="No anomalies"
        title="No anomalies detected"
        onClick={() => window.location.assign("/insights/anomalies")}
      >
        <ShieldAlert className="h-5 w-5" />
      </button>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="relative p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          aria-label={`${total} anomaly alert${total !== 1 ? "s" : ""}`}
        >
          <ShieldAlert className="h-5 w-5" />
          <span
            className={cn(
              "absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold text-white leading-none",
              critical > 0 ? "bg-red-500" : "bg-amber-500",
            )}
          >
            {total > 99 ? "99+" : total}
          </span>
        </button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-80 p-0 shadow-lg">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <span className="text-sm font-semibold text-slate-800">AI anomaly alerts</span>
          </div>
          <span className={cn(
            "text-xs font-medium px-2 py-0.5 rounded-full",
            critical > 0 ? "text-red-600 bg-red-50" : "text-amber-600 bg-amber-50",
          )}>
            {total} alert{total !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Preview list */}
        <ul className="divide-y divide-slate-100 max-h-60 overflow-y-auto">
          {preview.map((a, i) => (
            <li key={i} className="flex items-start gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors">
              {a.severity === "critical"
                ? <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-red-500" />
                : <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-500" />}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-slate-800 truncate">{a.entity_name}</p>
                <p className="text-[10px] text-slate-400">
                  {TYPE_LABEL[a.type] ?? a.type}
                  {a.branch_name ? ` · ${a.branch_name}` : ""}
                </p>
              </div>
              <span className={cn(
                "shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded",
                a.severity === "critical" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700",
              )}>
                {a.severity}
              </span>
            </li>
          ))}
        </ul>

        {/* Footer */}
        <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50">
          <Link
            href="/insights/anomalies"
            className="text-[11px] text-blue-600 hover:text-blue-700 font-medium"
            onClick={() => setOpen(false)}
          >
            View all alerts with AI explanations →
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
