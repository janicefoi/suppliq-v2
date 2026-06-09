import { Building2, Users, Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { OrgDetail } from "@/lib/actions/settings";

const PLAN_CONFIG = {
  FREE:       { label: "Free",       style: "bg-slate-100 text-slate-600 border-slate-200" },
  GROWTH:     { label: "Growth",     style: "bg-blue-50 text-blue-700 border-blue-200" },
  ENTERPRISE: { label: "Enterprise", style: "bg-violet-50 text-violet-700 border-violet-200" },
} as const;

const PLAN_FEATURES: Record<string, string[]> = {
  FREE: [
    "Up to 2 branches",
    "Up to 5 users",
    "Unlimited inventory items",
    "Sales, purchase orders & reports",
    "Community support",
  ],
  GROWTH: [
    "Up to 10 branches",
    "Unlimited users",
    "AI-powered demand forecasting",
    "Advanced reports & analytics",
    "Priority email support",
  ],
  ENTERPRISE: [
    "Unlimited branches & users",
    "Full AI supply-chain insights",
    "Custom integrations & API access",
    "Dedicated account manager",
    "SLA guarantee & on-site training",
  ],
};

export function BillingCard({ org }: { org: OrgDetail }) {
  const key = org.plan as keyof typeof PLAN_CONFIG;
  const config = PLAN_CONFIG[key] ?? PLAN_CONFIG.FREE;
  const features = PLAN_FEATURES[org.plan] ?? PLAN_FEATURES.FREE;
  const memberSince = new Date(org.createdAt).toLocaleDateString("en-KE", {
    day: "2-digit", month: "long", year: "numeric",
  });

  return (
    <div className="space-y-4">
      {/* Plan card */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Current plan</h2>
            <p className="text-sm text-slate-500 mt-0.5">Member since {memberSince}</p>
          </div>
          <Badge className={`shrink-0 text-sm font-semibold px-3 py-1 border ${config.style}`}>
            {config.label}
          </Badge>
        </div>

        <ul className="space-y-2">
          {features.map((f) => (
            <li key={f} className="flex items-center gap-2 text-sm text-slate-600">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500 shrink-0" />
              {f}
            </li>
          ))}
        </ul>

        {org.plan === "FREE" && (
          <div className="rounded-lg bg-blue-50 border border-blue-100 px-4 py-3 space-y-1">
            <p className="text-sm font-semibold text-blue-800">Upgrade to Growth or Enterprise</p>
            <p className="text-xs text-blue-600">
              Unlock AI demand forecasting, unlimited users, and advanced analytics.
            </p>
            <p className="text-xs text-blue-500 mt-1">
              Email <span className="font-medium">sales@suppliq.ai</span> to upgrade.
            </p>
          </div>
        )}
      </div>

      {/* Usage stats */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
        <h2 className="text-base font-semibold text-slate-900">Usage</h2>
        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: Building2, label: "Branches", value: org._counts.branches },
            { icon: Users,     label: "Users",    value: org._counts.users },
            { icon: Package,   label: "Items",    value: org._counts.items },
          ].map(({ icon: Icon, label, value }) => (
            <div
              key={label}
              className="flex flex-col items-center py-4 rounded-lg bg-slate-50 border border-slate-100"
            >
              <Icon className="h-5 w-5 text-slate-400 mb-2" />
              <p className="text-2xl font-bold text-slate-800 tabular-nums">{value}</p>
              <p className="text-xs text-slate-400 mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
