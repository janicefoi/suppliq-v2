import Link from "next/link";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import type { LowStockAlert } from "@/lib/actions/dashboard";
import { cn } from "@/lib/utils";

interface Props {
  items: LowStockAlert[];
}

export function LowStockList({ items }: Props) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-1.5">
        <AlertTriangle className="h-4 w-4 text-amber-500" />
        Low stock alerts
      </h2>
      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        {items.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
            <CheckCircle2 className="h-6 w-6 text-green-400" />
            All items are well stocked.
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {items.map((item) => {
              const ratio = item.stockQty / Math.max(1, item.lowStockThreshold);
              const isCritical = item.stockQty === 0 || ratio <= 0.25;
              return (
                <li
                  key={item.id}
                  className="px-4 py-2.5 flex items-center justify-between gap-3 hover:bg-slate-50/60 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-slate-800 truncate" title={item.name}>
                      {item.name}
                    </p>
                    <p className="font-mono text-[10px] text-slate-400">{item.sku}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p
                      className={cn(
                        "text-sm font-bold tabular-nums",
                        isCritical ? "text-red-600" : "text-amber-600"
                      )}
                    >
                      {item.stockQty === 0 ? "OUT" : item.stockQty}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      min {item.lowStockThreshold}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {items.length > 0 && (
          <div className="px-4 py-2 border-t border-slate-100 bg-slate-50">
            <Link
              href="/inventory"
              className="text-[11px] text-blue-600 hover:text-blue-700 font-medium"
            >
              View all inventory →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
