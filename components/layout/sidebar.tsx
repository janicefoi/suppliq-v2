"use client";

import Link from "next/link";
import { Logo } from "@/components/ui/logo";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { NAV_ITEMS, ROLE_LABELS } from "@/components/layout/nav-items";

interface SidebarUser {
  name?: string | null;
  email?: string | null;
  role: string;
}

interface SidebarProps {
  user: SidebarUser;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

function initials(name?: string | null) {
  if (!name) return "?";
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function roleBadgeClass(role: string) {
  switch (role) {
    case "ADMIN":
      return "bg-blue-500/20 text-blue-200 border-blue-500/30";
    case "MANAGER":
      return "bg-amber-500/20 text-amber-200 border-amber-500/30";
    default:
      return "bg-slate-500/20 text-slate-300 border-slate-500/30";
  }
}

// ── Shared sidebar content ─────────────────────────────────────────────────
function SidebarContent({
  user,
  onNavClick,
}: {
  user: SidebarUser;
  onNavClick?: () => void;
}) {
  const pathname = usePathname();

  const visibleLinks = NAV_ITEMS.filter((item) =>
    item.roles.includes(user.role)
  );

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-4 py-4">
        <Logo width={188} height={65} />
      </div>

      <Separator className="bg-[hsl(var(--sidebar-border))]" />

      {/* Nav links */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
        {visibleLinks.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavClick}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors border-l-2",
                isActive
                  ? "bg-[hsl(var(--sidebar-primary))] text-white border-white/60"
                  : "text-slate-300 hover:bg-white/10 hover:text-white border-transparent"
              )}
            >
              <Icon
                className={cn(
                  "h-4 w-4 shrink-0",
                  isActive ? "text-white" : "text-slate-400 group-hover:text-white"
                )}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <Separator className="bg-[hsl(var(--sidebar-border))]" />

      {/* User footer */}
      <div className="px-3 py-4 space-y-3">
        <div className="flex items-center gap-3 px-1">
          <Avatar className="h-8 w-8 shrink-0">
            <AvatarFallback className="bg-blue-500 text-white text-xs font-semibold">
              {initials(user.name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="text-white text-sm font-medium truncate">
              {user.name}
            </p>
            <span
              className={cn(
                "inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded border mt-0.5",
                roleBadgeClass(user.role)
              )}
            >
              {ROLE_LABELS[user.role] ?? user.role}
            </span>
          </div>
        </div>

        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 text-slate-400 hover:bg-white/10 hover:text-white"
          onClick={() => signOut({ callbackUrl: "/login" })}
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </Button>
      </div>
    </div>
  );
}

// ── Sidebar (desktop + mobile Sheet) ──────────────────────────────────────
export function Sidebar({ user, mobileOpen, onMobileClose }: SidebarProps) {
  return (
    <>
      {/* Desktop — fixed left */}
      <aside
        className="hidden md:flex flex-col fixed inset-y-0 left-0 w-60 z-30"
        style={{ background: "hsl(var(--sidebar-background))" }}
      >
        <SidebarContent user={user} />
      </aside>

      {/* Mobile — Sheet */}
      <Sheet open={mobileOpen} onOpenChange={onMobileClose}>
        <SheetContent
          side="left"
          className="w-60 p-0 border-r-0"
          style={{ background: "hsl(var(--sidebar-background))" }}
        >
          <SidebarContent user={user} onNavClick={onMobileClose} />
        </SheetContent>
      </Sheet>
    </>
  );
}
