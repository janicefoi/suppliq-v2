import { db } from "@/lib/db";
import { getPlanLimits } from "@/lib/constants/plans";

type LimitCheck = { allowed: true } | { allowed: false; error: string };

function planLabel(plan: string) {
  return plan.charAt(0) + plan.slice(1).toLowerCase();
}

export async function checkBranchLimit(orgId: string, plan: string): Promise<LimitCheck> {
  const { branches: limit } = getPlanLimits(plan);
  if (limit === null) return { allowed: true };

  const count = await db.branch.count({ where: { organizationId: orgId } });
  if (count >= limit) {
    const next = plan === "FREE" ? "Growth" : "Enterprise";
    return {
      allowed: false,
      error: `Your ${planLabel(plan)} plan allows up to ${limit} branch${limit > 1 ? "es" : ""}. Upgrade to ${next} to add more.`,
    };
  }
  return { allowed: true };
}

export async function checkUserLimit(orgId: string, plan: string): Promise<LimitCheck> {
  const { users: limit } = getPlanLimits(plan);
  if (limit === null) return { allowed: true };

  const count = await db.user.count({ where: { organizationId: orgId } });
  if (count >= limit) {
    const next = plan === "FREE" ? "Growth" : "Enterprise";
    return {
      allowed: false,
      error: `Your ${planLabel(plan)} plan allows up to ${limit} user${limit > 1 ? "s" : ""}. Upgrade to ${next} to add more.`,
    };
  }
  return { allowed: true };
}
