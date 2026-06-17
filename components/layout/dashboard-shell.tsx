"use client";

import { useState } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { Eye, X, Clock } from "lucide-react";
import { Sidebar } from "@/components/layout/sidebar";
import { TopBar } from "@/components/layout/top-bar";

interface ShellUser {
  id: string;
  name?: string | null;
  email?: string | null;
  role: string;
  plan?: string;
  trialEndsAt?: string | null;
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

function TrialBanner({ trialEndsAt }: { trialEndsAt: string }) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  const endsAt = new Date(trialEndsAt);
  const now = new Date();
  const daysLeft = Math.ceil((endsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (daysLeft <= 0) return null;

  const urgency = daysLeft <= 3;

  return (
    <div
      className={`border-b px-4 py-2.5 flex items-center justify-between gap-4 shrink-0 ${
        urgency
          ? "bg-red-50 border-red-200"
          : "bg-sky-50 border-sky-200"
      }`}
    >
      <div
        className={`flex items-center gap-2 text-sm min-w-0 ${
          urgency ? "text-red-800" : "text-sky-800"
        }`}
      >
        <Clock className={`h-4 w-4 shrink-0 ${urgency ? "text-red-500" : "text-sky-500"}`} />
        <span className="truncate">
          {daysLeft === 1
            ? "Your free trial ends tomorrow."
            : `Your free trial ends in ${daysLeft} days.`}{" "}
          Upgrade to keep access.
        </span>
      </div>
      <div className="flex items-center gap-3 shrink-0 text-sm">
        <Link
          href="/settings/billing"
          className={`font-semibold hover:underline whitespace-nowrap ${
            urgency ? "text-red-700" : "text-sky-700"
          }`}
        >
          Upgrade now
        </Link>
        <button
          onClick={() => setDismissed(true)}
          className={`p-0.5 ${urgency ? "text-red-400 hover:text-red-600" : "text-sky-400 hover:text-sky-600"}`}
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

  const plan = user.plan ?? "STARTER";
  const showTrial = !isDemo && !!user.trialEndsAt;

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar
        user={user}
        plan={plan}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      {/* Offset main content by sidebar width on desktop */}
      <div className="md:pl-60 flex flex-col min-h-screen">
        {isDemo && <DemoBanner />}
        {showTrial && <TrialBanner trialEndsAt={user.trialEndsAt!} />}
        <TopBar
          user={user}
          onMenuClick={() => setMobileOpen(true)}
          lowStockCount={lowStockCount ?? 0}
          plan={plan}
        />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
