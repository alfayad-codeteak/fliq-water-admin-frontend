"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  BarChart3,
  LayoutDashboard,
  Package,
  Settings,
  Shield,
  ShoppingCart,
  Truck,
  UserCircle,
  Users,
  Wallet,
} from "lucide-react";

import type { FeatureKey } from "@/lib/api/types";
import { isSameNavTarget } from "@/lib/navigation";
import { useUiStore } from "@/stores/ui-store";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";

type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  feature?: FeatureKey;
  ownerOnly?: boolean;
};

const nav: NavItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    feature: "dashboard",
  },
  { href: "/users", label: "Staff", icon: Users, ownerOnly: true },
  {
    href: "/products",
    label: "Products",
    icon: Package,
    feature: "products",
  },
  {
    href: "/orders",
    label: "Orders",
    icon: ShoppingCart,
    feature: "orders",
  },
  {
    href: "/delivery-partners",
    label: "Drivers",
    icon: Truck,
    feature: "orders",
  },
  {
    href: "/customers",
    label: "Customers",
    icon: UserCircle,
    feature: "customers",
  },
  {
    href: "/deposits",
    label: "Deposits",
    icon: Wallet,
    feature: "deposits",
  },
  {
    href: "/analytics",
    label: "Reports",
    icon: BarChart3,
    feature: "reports",
  },
  { href: "/settings", label: "Settings", icon: Settings },
];

function canSeeItem(
  item: NavItem,
  role: string | undefined,
  permissions: FeatureKey[] | undefined
): boolean {
  if (item.href === "/settings") return true;
  if (item.ownerOnly) return role === "owner";
  if (role === "owner") return true;
  if (!item.feature) return true;
  return permissions?.includes(item.feature) ?? false;
}

function navLinkClick<T extends HTMLElement>(
  pathname: string,
  href: string,
  upstreamOnClick: React.MouseEventHandler<T> | undefined,
  e: React.MouseEvent<T>
) {
  upstreamOnClick?.(e);
  if (e.defaultPrevented) return;
  if (!isSameNavTarget(pathname, href)) {
    useUiStore.getState().setNavigationPending(true);
  }
}

export function AppSidebar() {
  const pathname = usePathname();
  const { data } = useSession();
  const role = data?.user?.role;
  const permissions = data?.user?.permissions;

  const visible = nav.filter((item) => canSeeItem(item, role, permissions));

  return (
    <Sidebar collapsible="icon" variant="inset">
      <SidebarHeader className="border-b border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              className="data-[active=true]:bg-sidebar-accent"
              isActive={pathname === "/dashboard"}
              render={(props) => {
                const { onClick, href: _omitHref, ...rest } =
                  props as React.ComponentProps<typeof Link>;
                return (
                  <Link
                    {...rest}
                    href="/dashboard"
                    onClick={(e) =>
                      navLinkClick(pathname, "/dashboard", onClick, e)
                    }
                  />
                );
              }}
              tooltip="ProAdmin home"
            >
              <div className="flex size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                <Shield className="size-4" aria-hidden />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">ProAdmin</span>
                <span className="truncate text-xs text-muted-foreground">
                  Fliq admin
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visible.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    isActive={
                      pathname === item.href ||
                      pathname.startsWith(`${item.href}/`)
                    }
                    tooltip={item.label}
                    render={(props) => {
                      const { onClick, href: _omitHref, ...rest } =
                        props as React.ComponentProps<typeof Link>;
                      return (
                        <Link
                          {...rest}
                          href={item.href}
                          onClick={(e) =>
                            navLinkClick(pathname, item.href, onClick, e)
                          }
                        />
                      );
                    }}
                  >
                    <item.icon aria-hidden className="size-4" />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border text-xs text-muted-foreground">
        <p className="px-2 py-1">© {new Date().getFullYear()} ProAdmin</p>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
