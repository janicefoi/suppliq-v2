/**
 * Plan access control for SUPPLIQ.
 *
 * STARTER    — full core ERP, Sales report only, no AI. €29/mo with 14-day trial.
 * GROWTH     — + P&L + Stock Movements reports, + Reorder Alerts (top 5, no reasoning).
 * ENTERPRISE — + all AI modules with full Claude reasoning.
 *
 * Use `canAccess(session.user.plan, feature)` in server pages to gate access.
 * Use `planAtLeast` when you need to compare two plans directly.
 */

export type Plan = "STARTER" | "GROWTH" | "ENTERPRISE";

const PLAN_RANK: Record<Plan, number> = {
  STARTER: 0,
  GROWTH: 1,
  ENTERPRISE: 2,
};

export function planAtLeast(userPlan: string, required: Plan): boolean {
  return (PLAN_RANK[userPlan as Plan] ?? 0) >= PLAN_RANK[required];
}

// Feature key → minimum plan required
export const PLAN_FEATURES = {
  // Reports (beyond basic Sales)
  reports_pl:        "GROWTH",
  reports_stock:     "GROWTH",
  // AI — basic (5-item reorder list, no Claude reasoning)
  ai_reorder:        "GROWTH",
  // AI — full (all items + Claude reasoning)
  ai_reorder_full:   "ENTERPRISE",
  ai_overstock:      "ENTERPRISE",
  ai_transfers:      "ENTERPRISE",
  ai_abc:            "ENTERPRISE",
  ai_anomalies:      "ENTERPRISE",
  ai_cash_flow:      "ENTERPRISE",
  ai_briefing:       "ENTERPRISE",
  ai_market:         "ENTERPRISE",
} as const satisfies Record<string, Plan>;

export type FeatureKey = keyof typeof PLAN_FEATURES;

export function canAccess(userPlan: string, feature: FeatureKey): boolean {
  return planAtLeast(userPlan, PLAN_FEATURES[feature]);
}

// Human-readable plan names for UI copy
export const PLAN_NAMES: Record<Plan, string> = {
  STARTER:    "Starter",
  GROWTH:     "Growth",
  ENTERPRISE: "Enterprise",
};
