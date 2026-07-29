"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  BarChart3,
  LayoutDashboard,
  LogOut,
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
import { clearAuthStorage } from "@/lib/auth-storage";
import { isSameNavTarget } from "@/lib/navigation";
import { useUiStore } from "@/stores/ui-store";
import {
  SidebarNav,
  type NavGroupData,
  type NavItemData,
} from "@/components/ui/dashboard-sidebar";
import {
  Sidebar,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";

type AppNavItem = NavItemData & {
  feature?: FeatureKey;
  ownerOnly?: boolean;
};

const mainNav: AppNavItem[] = [
  {
    id: "dashboard",
    title: "Dashboard",
    icon: LayoutDashboard,
    href: "/dashboard",
    feature: "dashboard",
  },
  {
    id: "users",
    title: "Staff",
    icon: Users,
    href: "/users",
    ownerOnly: true,
  },
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
  {
    id: "deposits",
    title: "Deposits",
    icon: Wallet,
    href: "/deposits",
    feature: "deposits",
  },
  {
    id: "analytics",
    title: "Reports",
    icon: BarChart3,
    href: "/analytics",
    feature: "reports",
  },
];

function canSeeItem(
  item: AppNavItem,
  role: string | undefined,
  permissions: FeatureKey[] | undefined
): boolean {
  if (item.ownerOnly) return role === "owner";
  if (role === "owner") return true;
  if (!item.feature) return true;
  return permissions?.includes(item.feature) ?? false;
}

function activeIdFromPath(pathname: string, items: AppNavItem[]): string {
  const match = items
    .filter((item) => item.href)
    .find(
      (item) =>
        pathname === item.href || pathname.startsWith(`${item.href}/`)
    );
  return match?.id ?? "dashboard";
}

function SidebarBody() {
  const pathname = usePathname();
  const router = useRouter();
  const { data } = useSession();
  const { isMobile, setOpenMobile } = useSidebar();
  const role = data?.user?.role;
  const permissions = data?.user?.permissions;

  const visible = mainNav.filter((item) =>
    canSeeItem(item, role, permissions)
  );

  const navGroups: NavGroupData[] = [
    { items: visible.slice(0, 1) },
    {
      heading: "Operations",
      items: visible.slice(1),
    },
  ].filter((g) => g.items.length > 0);

  const bottomItems: NavItemData[] = [
    {
      id: "settings",
      title: "Settings",
      icon: Settings,
      href: "/settings",
      shortcut: "⌘,",
    },
    { id: "logout", title: "Log out", icon: LogOut },
  ];

  const activeId =
    pathname.startsWith("/settings")
      ? "settings"
      : activeIdFromPath(pathname, visible);

  const closeMobile = () => {
    if (isMobile) setOpenMobile(false);
  };

  const handleSelect = async (id: string) => {
    if (id === "logout") {
      clearAuthStorage();
      await signOut({ redirectTo: "/login" });
      router.push("/login");
      return;
    }

    const item = [...visible, ...bottomItems].find((i) => i.id === id);
    if (!item?.href) return;

    if (!isSameNavTarget(pathname, item.href)) {
      useUiStore.getState().setNavigationPending(true);
    }
    router.push(item.href);
    closeMobile();
  };

  const handleNavigate = (href: string) => {
    if (!isSameNavTarget(pathname, href)) {
      useUiStore.getState().setNavigationPending(true);
    }
    router.push(href);
    closeMobile();
  };

  return (
    <SidebarNav
      className="h-full w-full border-none bg-transparent"
      activeId={activeId}
      onSelect={handleSelect}
      onNavigate={handleNavigate}
      navGroups={navGroups}
      bottomItems={bottomItems}
      brand={{
        name: "Fliq",
        subtitle: "ADMIN",
        logoSrc: "/fliq-admin-icon.png",
        href: "/dashboard",
      }}
    />
  );
}

export function AppSidebar() {
  return (
    <Sidebar collapsible="offcanvas" variant="sidebar">
      <SidebarBody />
      <SidebarRail />
    </Sidebar>
  );
}
