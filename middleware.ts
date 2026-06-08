import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

// Use the edge-safe config — Prisma never runs in middleware
export default NextAuth(authConfig).auth;

export const config = {
  // Run on all routes except Next.js internals and static assets
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)"],
};
