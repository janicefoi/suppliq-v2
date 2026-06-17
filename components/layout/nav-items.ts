import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Users,
  Truck,
  ShoppingBag,
  ArrowLeftRight,
  Receipt,
  BarChart3,
  UserCog,
  ClipboardList,
  GitBranch,
  PackageSearch,
  TrendingDown,
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
    label: "Purchases",
    href: "/purchases",
    icon: ShoppingBag,
    roles: ["ADMIN", "MANAGER"],
  },
  {
    label: "Transfers",
    href: "/transfers",
    icon: ArrowLeftRight,
    roles: ["ADMIN", "MANAGER"],
  },
  {
    label: "Expenses",
    href: "/expenses",
    icon: Receipt,
    roles: ["ADMIN", "MANAGER"],
  },
  {
    label: "Reports",
    href: "/reports",
    icon: BarChart3,
    roles: ["ADMIN", "MANAGER"],
  },
  {
    label: "Reorder Alerts",
    href: "/insights/reorder",
    icon: PackageSearch,
    roles: ["ADMIN", "MANAGER"],
  },
  {
    label: "Overstock",
    href: "/insights/overstock",
    icon: TrendingDown,
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
  "/purchases": "Purchases",
  "/transfers": "Transfers",
  "/expenses": "Expenses",
  "/reports": "Reports",
  "/insights/reorder": "Reorder Alerts",
  "/insights/overstock": "Overstock",
  "/admin/employees": "Employees",
  "/admin/audit-log": "Audit Log",
  "/admin/branches": "Branches",
  "/settings/profile": "Settings",
  "/settings/organization": "Settings",
  "/settings/billing": "Settings",
};

export const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Admin",
  MANAGER: "Manager",
  CASHIER: "Cashier",
};
