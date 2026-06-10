"use client";

import { useState } from "react";
import { ReportsClient } from "@/components/reports/reports-client";
import { PLReport } from "@/components/reports/pl-report";
import { StockMovementReport } from "@/components/reports/stock-movement-report";

interface Props {
  role: string;
  branches: { id: string; name: string }[];
  currency: string;
}

const TABS = [
  { id: "sales",  label: "Sales",            adminOnly: false },
  { id: "pl",     label: "Profit & Loss",    adminOnly: true  },
  { id: "stock",  label: "Stock Movements",  adminOnly: false },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function ReportTabs({ role, branches, currency }: Props) {
  const isAdmin = role === "ADMIN";
  const [active, setActive] = useState<TabId>("sales");

  const visibleTabs = TABS.filter((t) => !t.adminOnly || isAdmin);

  return (
    <div className="space-y-4">
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

      {active === "sales" && (
        <ReportsClient role={role} branches={branches} currency={currency} />
      )}
      {active === "pl" && isAdmin && (
        <PLReport branches={branches} currency={currency} />
      )}
      {active === "stock" && (
        <StockMovementReport role={role} branches={isAdmin ? branches : []} />
      )}
    </div>
  );
}
