"use client";

import { useState } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { Eye, X } from "lucide-react";
import { Sidebar } from "@/components/layout/sidebar";
import { TopBar } from "@/components/layout/top-bar";

interface ShellUser {
  id: string;
  name?: string | null;
  email?: string | null;
  role: string;
}

interface DashboardShellProps {
  user: ShellUser;
  isDemo?: boolean;
  lowStockCount?: number;
  children: React.ReactNode;
}

function DemoBanner() {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;
  return (
    <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 flex items-center justify-between gap-4 shrink-0">
      <div className="flex items-center gap-2 text-amber-800 text-sm min-w-0">
        <Eye className="h-4 w-4 shrink-0 text-amber-600" />
        <span className="truncate">
          You&apos;re viewing a live demo with sample data. Changes are blocked.
        </span>
      </div>
      <div className="flex items-center gap-3 shrink-0 text-sm">
        <Link
          href="/register"
          className="font-semibold text-blue-600 hover:text-blue-700 hover:underline whitespace-nowrap"
        >
          Sign up free
        </Link>
        <button
          onClick={() => signOut({ callbackUrl: "/" })}
          className="text-amber-700 hover:text-amber-900 whitespace-nowrap font-medium"
        >
          Exit demo
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="text-amber-400 hover:text-amber-600 p-0.5"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export function DashboardShell({ user, isDemo, lowStockCount, children }: DashboardShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar
        user={user}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      {/* Offset main content by sidebar width on desktop */}
      <div className="md:pl-60 flex flex-col min-h-screen">
        {isDemo && <DemoBanner />}
        <TopBar
          user={user}
          onMenuClick={() => setMobileOpen(true)}
          lowStockCount={lowStockCount ?? 0}
        />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
