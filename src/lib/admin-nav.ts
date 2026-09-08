import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Image as ImageIcon,
  LayoutDashboard,
  MapPinned,
  Package,
  PackagePlus,
  Settings,
  ShoppingCart,
  Truck,
  UserCircle,
  Users,
  Wallet,
} from "lucide-react";

import type { FeatureKey } from "@/lib/api/types";

export type AdminNavItem = {
  id: string;
  title: string;
  href: string;
  icon: LucideIcon;
  feature?: FeatureKey;
  ownerOnly?: boolean;
};

export type AdminNavGroup = {
  heading: string;
  items: AdminNavItem[];
};

export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  {
    heading: "Overview",
    items: [
      {
        id: "dashboard",
        title: "Dashboard",
        icon: LayoutDashboard,
        href: "/dashboard",
        feature: "dashboard",
      },
    ],
  },
  {
    heading: "Operations",
    items: [
      {
        id: "orders",
        title: "Orders",
        icon: ShoppingCart,
        href: "/orders",
        feature: "orders",
      },
      {
        id: "drivers",
        title: "Drivers",
        icon: Truck,
        href: "/delivery-partners",
        feature: "orders",
      },
      {
        id: "zones",
        title: "Delivery zones",
        icon: MapPinned,
        href: "/delivery-zones",
      },
      {
        id: "customers",
        title: "Customers",
        icon: UserCircle,
        href: "/customers",
        feature: "customers",
      },
    ],
  },
  {
    heading: "Catalog",
    items: [
      {
        id: "products",
        title: "Products",
        icon: Package,
        href: "/products",
        feature: "products",
      },
      {
        id: "purchases",
        title: "Purchases",
        icon: PackagePlus,
        href: "/purchase-entries",
        feature: "products",
      },
      {
        id: "banners",
        title: "Banners",
        icon: ImageIcon,
        href: "/banners",
        feature: "banners",
      },
    ],
  },
  {
    heading: "Finance",
    items: [
      {
        id: "deposits",
        title: "Deposits",
        icon: Wallet,
        href: "/deposits",
        feature: "deposits",
      },
    ],
  },
  {
    heading: "Insights",
    items: [
      {
        id: "analytics",
        title: "Reports",
        icon: BarChart3,
        href: "/analytics",
        feature: "reports",
      },
    ],
  },
  {
    heading: "Admin",
    items: [
      {
        id: "users",
        title: "Staff",
        icon: Users,
        href: "/users",
        ownerOnly: true,
      },
    ],
  },
];

export const SETTINGS_NAV: AdminNavItem = {
  id: "settings",
  title: "Settings",
  icon: Settings,
  href: "/settings",
};

export function canSeeNavItem(
  item: AdminNavItem,
  role: string | undefined,
  permissions: FeatureKey[] | undefined
): boolean {
  if (item.ownerOnly) return role === "owner";
  if (role === "owner") return true;
  if (!item.feature) return true;
  return permissions?.includes(item.feature) ?? false;
}

export function titleFromPath(pathname: string): string {
  const all = [
    ...ADMIN_NAV_GROUPS.flatMap((g) => g.items),
    SETTINGS_NAV,
  ];
  const match = all
    .filter((item) => item.href)
    .sort((a, b) => b.href.length - a.href.length)
    .find(
      (item) => pathname === item.href || pathname.startsWith(`${item.href}/`)
    );
  return match?.title ?? "Admin";
}

export function activeIdFromPath(pathname: string): string {
  if (pathname.startsWith("/settings")) return "settings";
  const all = ADMIN_NAV_GROUPS.flatMap((g) => g.items);
  const match = all
    .sort((a, b) => b.href.length - a.href.length)
    .find(
      (item) => pathname === item.href || pathname.startsWith(`${item.href}/`)
    );
  return match?.id ?? "dashboard";
}
