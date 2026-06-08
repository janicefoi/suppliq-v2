import Link from "next/link";
import { CreditCard, CheckCircle2 } from "lucide-react";
import type { TopDebtor } from "@/lib/actions/dashboard";

function fmtKES(v: number) {
  return `KES ${v.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function TopDebtors({ debtors }: { debtors: TopDebtor[] }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
          <CreditCard className="h-4 w-4 text-red-400" />
          Top debtors
        </h2>
        <Link href="/customers?filter=HAS_CREDIT" className="text-[11px] text-blue-600 hover:text-blue-700 font-medium">
          View all →
        </Link>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        {debtors.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
            <CheckCircle2 className="h-6 w-6 text-green-400" />
            No outstanding credit.
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {debtors.map((d, idx) => (
              <li key={d.id} className="px-4 py-2.5 flex items-center justify-between gap-3 hover:bg-slate-50/60 transition-colors">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className="h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                    style={{ background: idx === 0 ? "#fef2f2" : "#f8fafc", color: idx === 0 ? "#dc2626" : "#94a3b8" }}
                  >
                    {idx + 1}
                  </span>
                  <div className="min-w-0">
                    <Link href={`/customers/${d.id}`}>
                      <p className="text-xs font-semibold text-slate-800 hover:text-blue-600 truncate transition-colors">
                        {d.name}
                      </p>
                    </Link>
                    <p className="text-[10px] text-slate-400">{d.phone}</p>
                  </div>
                </div>
                <p className="text-sm font-bold text-red-600 tabular-nums shrink-0">
                  {fmtKES(Number(d.creditBalance))}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
