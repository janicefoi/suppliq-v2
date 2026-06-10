"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, Bell, AlertTriangle, CheckCircle2, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PAGE_TITLES } from "@/components/layout/nav-items";
import { getLowStockAlerts, type LowStockAlert } from "@/lib/actions/dashboard";
import { cn } from "@/lib/utils";

interface TopBarUser {
  name?: string | null;
  role: string;
  branchId?: string | null;
}

interface TopBarProps {
  user: TopBarUser;
  onMenuClick: () => void;
  lowStockCount: number;
}

function initials(name?: string | null) {
  if (!name) return "?";
  return name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

function LowStockPopover({
  count,
  branchId,
}: {
  count: number;
  branchId?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [alerts, setAlerts] = useState<LowStockAlert[] | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleOpen(next: boolean) {
    setOpen(next);
    if (next && alerts === null && !loading) {
      setLoading(true);
      const result = await getLowStockAlerts(branchId ?? null);
      setAlerts(result);
      setLoading(false);
    }
  }

  return (
    <Popover open={open} onOpenChange={handleOpen}>
      <PopoverTrigger asChild>
        <button
          className="relative p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          aria-label="Low stock alerts"
        >
          <Bell className="h-5 w-5" />
          {count > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white leading-none">
              {count > 99 ? "99+" : count}
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-80 p-0 shadow-lg">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <span className="text-sm font-semibold text-slate-800">Low stock alerts</span>
          </div>
          {count > 0 && (
            <span className="text-xs font-medium text-red-500 bg-red-50 px-2 py-0.5 rounded-full">
              {count} item{count !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        <div className="max-h-72 overflow-y-auto">
          {loading && (
            <div className="py-8 text-center text-xs text-slate-400">Loading…</div>
          )}
          {!loading && alerts !== null && alerts.length === 0 && (
            <div className="py-8 text-center flex flex-col items-center gap-2">
              <CheckCircle2 className="h-6 w-6 text-green-400" />
              <p className="text-xs text-slate-400">All items are well stocked</p>
            </div>
          )}
          {!loading && alerts !== null && alerts.length > 0 && (
            <ul className="divide-y divide-slate-100">
              {alerts.map((item) => {
                const isCritical = item.stockQty === 0 || item.stockQty / Math.max(1, item.lowStockThreshold) <= 0.25;
                return (
                  <li key={item.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors">
                    <Package className={cn("h-3.5 w-3.5 shrink-0", isCritical ? "text-red-400" : "text-amber-400")} />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-slate-800 truncate">{item.name}</p>
                      <p className="text-[10px] font-mono text-slate-400">{item.sku}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={cn("text-sm font-bold tabular-nums", isCritical ? "text-red-600" : "text-amber-600")}>
                        {item.stockQty === 0 ? "OUT" : item.stockQty}
                      </p>
                      <p className="text-[10px] text-slate-400">min {item.lowStockThreshold}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50">
          <a
            href="/inventory"
            className="text-[11px] text-blue-600 hover:text-blue-700 font-medium"
            onClick={() => setOpen(false)}
          >
            View inventory →
          </a>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function TopBar({ user, onMenuClick, lowStockCount }: TopBarProps) {
  const pathname = usePathname();
  const title = PAGE_TITLES[pathname] ?? "Dashboard";

  return (
    <header className="sticky top-0 z-20 flex items-center h-14 px-4 gap-4 bg-white border-b border-slate-200 shrink-0">
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden text-slate-500 hover:text-slate-900"
        onClick={onMenuClick}
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </Button>

      <h1 className="flex-1 text-base font-semibold text-slate-900 truncate">{title}</h1>

      <div className="flex items-center gap-2 shrink-0">
        <LowStockPopover count={lowStockCount} branchId={user.branchId} />

        <div className="flex items-center gap-2.5">
          <span className="hidden sm:block text-sm font-medium text-slate-700 truncate max-w-[140px]">
            {user.name}
          </span>
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-blue-600 text-white text-xs font-semibold">
              {initials(user.name)}
            </AvatarFallback>
          </Avatar>
        </div>
      </div>
    </header>
  );
}
