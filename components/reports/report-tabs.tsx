"use client";

import { useState } from "react";
import Link from "next/link";
import { Lock } from "lucide-react";
import { ReportsClient } from "@/components/reports/reports-client";
import { PLReport } from "@/components/reports/pl-report";
import { StockMovementReport } from "@/components/reports/stock-movement-report";
import { planAtLeast } from "@/lib/plans";

interface Props {
  role: string;
  branches: { id: string; name: string }[];
  currency: string;
  plan: string;
}

const TABS = [
  { id: "sales",  label: "Sales",           adminOnly: false, minPlan: "STARTER" },
  { id: "pl",     label: "Profit & Loss",   adminOnly: true,  minPlan: "GROWTH"  },
  { id: "stock",  label: "Stock Movements", adminOnly: false, minPlan: "GROWTH"  },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function ReportTabs({ role, branches, currency, plan }: Props) {
  const isAdmin = role === "ADMIN";
  const [active, setActive] = useState<TabId>("sales");

  const visibleTabs = TABS.filter(
    (t) => (!t.adminOnly || isAdmin) && planAtLeast(plan, t.minPlan as "STARTER" | "GROWTH" | "ENTERPRISE")
  );

  const hasGrowth = planAtLeast(plan, "GROWTH");

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit">
          {visibleTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActive(tab.id)}
              className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                active === tab.id
                  ? "bg-white shadow-sm text-slate-900"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {isAdmin && !hasGrowth && (
          <Link
            href="/settings/billing"
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 border border-dashed border-slate-300 rounded-lg px-3 py-1.5 transition-colors"
          >
            <Lock className="h-3 w-3" />
            Profit &amp; Loss and Stock Movements require the Growth plan
          </Link>
        )}
      </div>

      {active === "sales" && (
        <ReportsClient role={role} branches={branches} currency={currency} />
      )}
      {active === "pl" && isAdmin && hasGrowth && (
        <PLReport branches={branches} currency={currency} />
      )}
      {active === "stock" && hasGrowth && (
        <StockMovementReport role={role} branches={isAdmin ? branches : []} />
      )}
    </div>
  );
}
