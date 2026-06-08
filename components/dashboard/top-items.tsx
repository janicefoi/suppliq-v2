import { Package } from "lucide-react";
import type { TopItem } from "@/lib/actions/dashboard";

function fmtKES(v: number) {
  return `KES ${v.toLocaleString("en-KE", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function TopItems({ items }: { items: TopItem[] }) {
  const maxQty = Math.max(...items.map((i) => i.totalQty), 1);

  return (
    <div>
      <h2 className="text-sm font-semibold text-slate-700 mb-3">Top selling items — last 7 days</h2>
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        {items.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
            <Package className="h-6 w-6 opacity-30" />
            No sales in the last 7 days.
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {items.map((item, idx) => (
              <li key={item.id} className="px-4 py-3">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-xs font-bold text-slate-300 w-4 shrink-0">#{idx + 1}</span>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-800 truncate">{item.name}</p>
                      <p className="font-mono text-[10px] text-slate-400">{item.sku}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-bold text-slate-800 tabular-nums">{item.totalQty} units</p>
                    <p className="text-[10px] text-slate-400 tabular-nums">{fmtKES(item.totalRevenue)}</p>
                  </div>
                </div>
                <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-1 bg-blue-500 rounded-full transition-all"
                    style={{ width: `${(item.totalQty / maxQty) * 100}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
