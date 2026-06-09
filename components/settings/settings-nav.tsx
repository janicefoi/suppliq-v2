"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { User, Building2, CreditCard } from "lucide-react";
import { cn } from "@/lib/utils";

const links = [
  { href: "/settings/profile",      label: "Profile",      icon: User,        roles: ["ADMIN", "MANAGER", "CASHIER"] },
  { href: "/settings/organization", label: "Organization", icon: Building2,   roles: ["ADMIN"] },
  { href: "/settings/billing",      label: "Billing",      icon: CreditCard,  roles: ["ADMIN"] },
];

export function SettingsNav({ role }: { role: string }) {
  const pathname = usePathname();
  const visible = links.filter((l) => l.roles.includes(role));

  return (
    <nav className="w-44 shrink-0 space-y-0.5">
      {visible.map((link) => {
        const Icon = link.icon;
        const active = pathname === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
              active
                ? "bg-slate-100 text-slate-900"
                : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
            )}
          >
            <Icon className={cn("h-4 w-4 shrink-0", active ? "text-slate-700" : "text-slate-400")} />
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
