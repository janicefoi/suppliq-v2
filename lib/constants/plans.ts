// Plan definitions and hard limits enforced server-side.
// null means unlimited.

export const PLAN_LIMITS = {
  STARTER:    { branches: 1,    users: 3,    items: 100 },
  GROWTH:     { branches: 3,    users: 10,   items: 1000 },
  ENTERPRISE: { branches: null, users: null, items: null },
} as const;

export type PlanKey = keyof typeof PLAN_LIMITS;

export function getPlanLimits(plan: string) {
  return PLAN_LIMITS[plan as PlanKey] ?? PLAN_LIMITS.STARTER;
}

export const PLAN_DISPLAY = {
  STARTER:    { label: "Starter",    badge: "bg-slate-100 text-slate-600 border-slate-200" },
  GROWTH:     { label: "Growth",     badge: "bg-blue-50 text-blue-700 border-blue-200" },
  ENTERPRISE: { label: "Enterprise", badge: "bg-violet-50 text-violet-700 border-violet-200" },
} as const;
