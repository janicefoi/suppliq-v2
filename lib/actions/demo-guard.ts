"use server";

import { auth } from "@/auth";

const DEMO_ERROR = "Demo accounts are read-only. Sign up to create your own account.";

export async function rejectIfDemo(): Promise<{ blocked: true; error: string } | { blocked: false }> {
  const session = await auth();
  if (session?.user?.isDemo) return { blocked: true, error: DEMO_ERROR };
  return { blocked: false };
}
