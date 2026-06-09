// Plan definitions and hard limits enforced server-side.
// null means unlimited.

export const PLAN_LIMITS = {
  FREE:       { branches: 2,    users: 5,    items: null },
  GROWTH:     { branches: 10,   users: 25,   items: null },
  ENTERPRISE: { branches: null, users: null, items: null },
} as const;

export type PlanKey = keyof typeof PLAN_LIMITS;

export function getPlanLimits(plan: string) {
  return PLAN_LIMITS[plan as PlanKey] ?? PLAN_LIMITS.FREE;
}

export const PLAN_DISPLAY = {
  FREE:       { label: "Free",       badge: "bg-slate-100 text-slate-600 border-slate-200" },
  GROWTH:     { label: "Growth",     badge: "bg-blue-50 text-blue-700 border-blue-200" },
  ENTERPRISE: { label: "Enterprise", badge: "bg-violet-50 text-violet-700 border-violet-200" },
} as const;
