import { db } from "@/lib/db";
import { getPlanLimits } from "@/lib/constants/plans";

type LimitCheck = { allowed: true } | { allowed: false; error: string };

export async function checkBranchLimit(orgId: string, plan: string): Promise<LimitCheck> {
  const { branches: limit } = getPlanLimits(plan);
  if (limit === null) return { allowed: true };

  const count = await db.branch.count({ where: { organizationId: orgId } });
  if (count >= limit) {
    return {
      allowed: false,
      error: `Your ${plan} plan allows up to ${limit} branches. Upgrade to add more.`,
    };
  }
  return { allowed: true };
}

export async function checkUserLimit(orgId: string, plan: string): Promise<LimitCheck> {
  const { users: limit } = getPlanLimits(plan);
  if (limit === null) return { allowed: true };

  const count = await db.user.count({ where: { organizationId: orgId } });
  if (count >= limit) {
    return {
      allowed: false,
      error: `Your ${plan} plan allows up to ${limit} users. Upgrade to add more.`,
    };
  }
  return { allowed: true };
}
