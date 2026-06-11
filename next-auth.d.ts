import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;
      branchId: string | null;
      organizationId: string;
      currency: string;
      plan: string;
      isDemo: boolean;
    } & DefaultSession["user"];
  }
}
