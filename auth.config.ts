import type { NextAuthConfig } from "next-auth";

// Edge-safe config — no Prisma, no Node-only modules.
// Used by middleware to verify JWT and enforce route guards.
export const authConfig: NextAuthConfig = {
  pages: {
    signIn: "/login",
  },
  session: { strategy: "jwt" },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const path = nextUrl.pathname;

      // Always pass NextAuth API routes through
      if (path.startsWith("/api/auth")) return true;

      // Auth pages: bounce already-authenticated users to dashboard
      if (path === "/login" || path === "/signup") {
        return isLoggedIn
          ? Response.redirect(new URL("/dashboard", nextUrl))
          : true;
      }

      // Admin-only section — non-admins bounce to /dashboard
      if (path.startsWith("/admin")) {
        if (!isLoggedIn) return false; // → /login
        if (auth?.user?.role !== "ADMIN") {
          return Response.redirect(new URL("/dashboard", nextUrl));
        }
        return true;
      }

      // Every other route requires login
      return isLoggedIn; // false → /login
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role: string }).role;
        token.branchId = (user as { branchId?: string | null }).branchId ?? null;
        token.organizationId = (user as { organizationId: string }).organizationId;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.id as string;
      session.user.role = token.role as string;
      session.user.branchId = (token.branchId ?? null) as string | null;
      session.user.organizationId = token.organizationId as string;
      return session;
    },
  },
  providers: [],
};
