import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Users,
  Truck,
  BarChart3,
  UserCog,
  ClipboardList,
  GitBranch,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  roles: string[];
}

export const NAV_ITEMS: NavItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    roles: ["ADMIN", "MANAGER", "CASHIER"],
  },
  {
    label: "Point of Sale",
    href: "/pos",
    icon: ShoppingCart,
    roles: ["MANAGER", "CASHIER"],
  },
  {
    label: "Inventory",
    href: "/inventory",
    icon: Package,
    roles: ["ADMIN", "MANAGER", "CASHIER"],
  },
  {
    label: "Customers",
    href: "/customers",
    icon: Users,
    roles: ["ADMIN", "MANAGER", "CASHIER"],
  },
  {
    label: "Suppliers",
    href: "/suppliers",
    icon: Truck,
    roles: ["ADMIN", "MANAGER", "CASHIER"],
  },
  {
    label: "Reports",
    href: "/reports",
    icon: BarChart3,
    roles: ["ADMIN", "MANAGER"],
  },
  {
    label: "Employees",
    href: "/admin/employees",
    icon: UserCog,
    roles: ["ADMIN"],
  },
  {
    label: "Audit Log",
    href: "/admin/audit-log",
    icon: ClipboardList,
    roles: ["ADMIN"],
  },
  {
    label: "Branches",
    href: "/admin/branches",
    icon: GitBranch,
    roles: ["ADMIN"],
  },
];

export const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/pos": "Point of Sale",
  "/inventory": "Inventory",
  "/customers": "Customers",
  "/suppliers": "Suppliers",
  "/reports": "Reports",
  "/admin/employees": "Employees",
  "/admin/audit-log": "Audit Log",
  "/admin/branches": "Branches",
};

export const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Admin",
  MANAGER: "Manager",
  CASHIER: "Cashier",
};
