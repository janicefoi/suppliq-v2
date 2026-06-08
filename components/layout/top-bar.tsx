"use client";

import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { PAGE_TITLES } from "@/components/layout/nav-items";

interface TopBarUser {
  name?: string | null;
  role: string;
}

interface TopBarProps {
  user: TopBarUser;
  onMenuClick: () => void;
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

export function TopBar({ user, onMenuClick }: TopBarProps) {
  const pathname = usePathname();
  const title = PAGE_TITLES[pathname] ?? "Dashboard";

  return (
    <header className="sticky top-0 z-20 flex items-center h-14 px-4 gap-4 bg-white border-b border-slate-200 shrink-0">
      {/* Mobile hamburger */}
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden text-slate-500 hover:text-slate-900"
        onClick={onMenuClick}
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* Page title */}
      <h1 className="flex-1 text-base font-semibold text-slate-900 truncate">
        {title}
      </h1>

      {/* User pill */}
      <div className="flex items-center gap-2.5 shrink-0">
        <span className="hidden sm:block text-sm font-medium text-slate-700 truncate max-w-[140px]">
          {user.name}
        </span>
        <Avatar className="h-8 w-8">
          <AvatarFallback className="bg-blue-600 text-white text-xs font-semibold">
            {initials(user.name)}
          </AvatarFallback>
        </Avatar>
      </div>
    </header>
  );
}
