import { Building2, Users, Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { BillingActions } from "@/components/settings/billing-actions";
import type { OrgDetail } from "@/lib/actions/settings";

const PLAN_CONFIG = {
  FREE:       { label: "Free",       style: "bg-slate-100 text-slate-600 border-slate-200" },
  GROWTH:     { label: "Growth",     style: "bg-blue-50 text-blue-700 border-blue-200" },
  ENTERPRISE: { label: "Enterprise", style: "bg-violet-50 text-violet-700 border-violet-200" },
} as const;

const STATUS_CONFIG: Record<string, { label: string; style: string }> = {
  active:     { label: "Active",     style: "bg-green-50 text-green-700 border-green-200" },
  trialing:   { label: "Trial",      style: "bg-teal-50 text-teal-700 border-teal-200" },
  past_due:   { label: "Past due",   style: "bg-amber-50 text-amber-700 border-amber-200" },
  canceled:   { label: "Canceled",   style: "bg-red-50 text-red-700 border-red-200" },
  incomplete: { label: "Incomplete", style: "bg-slate-50 text-slate-600 border-slate-200" },
};

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
    "Up to 25 users",
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
  const memberSince = new Date(org.createdAt).toLocaleDateString("en-GB", {
    day: "2-digit", month: "long", year: "numeric",
  });

  const statusCfg = org.subscriptionStatus
    ? (STATUS_CONFIG[org.subscriptionStatus] ?? null)
    : null;

  const renewsOn = org.currentPeriodEnd
    ? new Date(org.currentPeriodEnd).toLocaleDateString("en-GB", {
        day: "2-digit", month: "long", year: "numeric",
      })
    : null;

  return (
    <div className="space-y-4">
      {/* Plan card */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Current plan</h2>
            <p className="text-sm text-slate-500 mt-0.5">Member since {memberSince}</p>
            {renewsOn && (
              <p className="text-xs text-slate-400 mt-0.5">
                {org.subscriptionStatus === "canceled" ? "Expires" : "Renews"} {renewsOn}
              </p>
            )}
          </div>
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <Badge className={`text-sm font-semibold px-3 py-1 border ${config.style}`}>
              {config.label}
            </Badge>
            {statusCfg && (
              <Badge variant="outline" className={`text-xs px-2 py-0.5 border ${statusCfg.style}`}>
                {statusCfg.label}
              </Badge>
            )}
          </div>
        </div>

        <ul className="space-y-2">
          {features.map((f) => (
            <li key={f} className="flex items-center gap-2 text-sm text-slate-600">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500 shrink-0" />
              {f}
            </li>
          ))}
        </ul>

        <BillingActions
          plan={org.plan}
          subscriptionStatus={org.subscriptionStatus}
          stripeCustomerId={org.stripeCustomerId}
        />
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
