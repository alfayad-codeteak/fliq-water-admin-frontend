"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { ChevronsLeft, ChevronsRight, LogOut } from "lucide-react";

import {
  ADMIN_NAV_GROUPS,
  SETTINGS_NAV,
  activeIdFromPath,
  canSeeNavItem,
  type AdminNavItem,
} from "@/lib/admin-nav";
import { clearAuthStorage } from "@/lib/auth-storage";
import { isSameNavTarget } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { useShellStore } from "@/stores/shell-store";
import { useUiStore } from "@/stores/ui-store";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

function NavLink({
  item,
  active,
  collapsed,
  onClick,
}: {
  item: AdminNavItem;
  active: boolean;
  collapsed: boolean;
  onClick: () => void;
}) {
  const Icon = item.icon;
  const className = cn(
    "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-bold transition-colors",
    collapsed && "justify-center px-0",
    active
      ? "bg-sky-50 text-sky-800 ring-1 ring-sky-100"
      : "text-slate-800 hover:bg-slate-100"
  );
  const inner = (
    <>
      <Icon className="size-4 shrink-0" />
      {collapsed ? null : <span className="truncate">{item.title}</span>}
    </>
  );

  if (!collapsed) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-current={active ? "page" : undefined}
        className={className}
      >
        {inner}
      </button>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger
        type="button"
        onClick={onClick}
        aria-current={active ? "page" : undefined}
        className={className}
      >
        {inner}
      </TooltipTrigger>
      <TooltipContent side="right">{item.title}</TooltipContent>
    </Tooltip>
  );
}

function SidebarNavList({
  collapsed,
  onNavigate,
}: {
  collapsed: boolean;
  onNavigate: (href: string) => void;
}) {
  const pathname = usePathname();
  const { data } = useSession();
  const role = data?.user?.role;
  const permissions = data?.user?.permissions;
  const activeId = activeIdFromPath(pathname);

  const groups = ADMIN_NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => canSeeNavItem(item, role, permissions)),
  })).filter((group) => group.items.length > 0);

  return (
    <nav className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-2 py-3 [scrollbar-width:thin]">
      {groups.map((group) => (
        <div key={group.heading} className="flex flex-col gap-0.5">
          {collapsed ? (
            <div className="mx-auto mb-1 h-px w-6 bg-slate-200" />
          ) : (
            <p className="px-3 pb-1 text-[10px] font-bold tracking-[0.16em] text-slate-500 uppercase">
              {group.heading}
            </p>
          )}
          {group.items.map((item) => (
            <NavLink
              key={item.id}
              item={item}
              active={activeId === item.id}
              collapsed={collapsed}
              onClick={() => onNavigate(item.href)}
            />
          ))}
        </div>
      ))}
    </nav>
  );
}

function SidebarFooter({
  collapsed,
  onNavigate,
}: {
  collapsed: boolean;
  onNavigate: (href: string) => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const active = pathname.startsWith("/settings");

  return (
    <div className="mt-auto flex flex-col gap-0.5 border-t border-slate-200 px-2 py-3">
      <NavLink
        item={SETTINGS_NAV}
        active={active}
        collapsed={collapsed}
        onClick={() => onNavigate(SETTINGS_NAV.href)}
      />
      <button
        type="button"
        className={cn(
          "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-bold text-slate-800 transition-colors hover:bg-red-50 hover:text-red-700",
          collapsed && "justify-center px-0"
        )}
        onClick={async () => {
          clearAuthStorage();
          await signOut({ redirectTo: "/login" });
          router.push("/login");
        }}
      >
        <LogOut className="size-4 shrink-0" />
        {collapsed ? null : <span>Log out</span>}
      </button>
    </div>
  );
}

function SidebarPanel({ collapsed }: { collapsed: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const setMobileOpen = useShellStore((s) => s.setMobileOpen);

  const go = (href: string) => {
    if (!isSameNavTarget(pathname, href)) {
      useUiStore.getState().setNavigationPending(true);
    }
    router.push(href);
    setMobileOpen(false);
  };

  return (
    <div className="flex h-full flex-col">
      <SidebarNavList collapsed={collapsed} onNavigate={go} />
      <SidebarFooter collapsed={collapsed} onNavigate={go} />
    </div>
  );
}

function SidebarEdgeHandle({ collapsed }: { collapsed: boolean }) {
  const setCollapsed = useShellStore((s) => s.setCollapsed);
  const drag = React.useRef<{
    active: boolean;
    startX: number;
    moved: boolean;
    startCollapsed: boolean;
  }>({ active: false, startX: 0, moved: false, startCollapsed: false });

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    drag.current = {
      active: true,
      startX: e.clientX,
      moved: false,
      startCollapsed: collapsed,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current.active) return;
    const dx = e.clientX - drag.current.startX;
    if (Math.abs(dx) > 6) drag.current.moved = true;
    if (!drag.current.startCollapsed && dx < -36) setCollapsed(true);
    if (drag.current.startCollapsed && dx > 36) setCollapsed(false);
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current.active) return;
    const wasClick = !drag.current.moved;
    drag.current.active = false;
    if (wasClick) {
      useShellStore.getState().toggleCollapsed();
    }
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  return (
    <div
      className="group/edge absolute inset-y-0 -right-2 z-20 hidden w-4 cursor-col-resize touch-none lg:flex"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      role="separator"
      aria-orientation="vertical"
      aria-label={collapsed ? "Drag right to expand sidebar" : "Drag left to collapse sidebar"}
      title={collapsed ? "Drag to expand" : "Drag to collapse"}
    >
      <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-transparent transition-colors group-hover/edge:bg-sky-500" />
      <span
        className={cn(
          "pointer-events-none absolute top-1/2 left-1/2 flex size-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm",
          "opacity-0 scale-90 transition-all duration-150 group-hover/edge:opacity-100 group-hover/edge:scale-100 group-active/edge:opacity-100"
        )}
      >
        {collapsed ? (
          <ChevronsRight className="size-3.5" />
        ) : (
          <ChevronsLeft className="size-3.5" />
        )}
      </span>
    </div>
  );
}

export function AppSidebar() {
  const collapsed = useShellStore((s) => s.collapsed);
  const mobileOpen = useShellStore((s) => s.mobileOpen);
  const setMobileOpen = useShellStore((s) => s.setMobileOpen);

  return (
    <>
      <aside
        className={cn(
          "relative hidden h-full shrink-0 flex-col bg-white text-slate-900 lg:flex",
          "border-r border-slate-200 transition-[width] duration-200 ease-out",
          collapsed ? "w-[72px]" : "w-[260px]"
        )}
      >
        <SidebarPanel collapsed={collapsed} />
        <SidebarEdgeHandle collapsed={collapsed} />
      </aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent
          side="left"
          className="w-[min(100%,280px)] border-slate-200 bg-white p-0 text-slate-900"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Navigation</SheetTitle>
            <SheetDescription>Admin pages</SheetDescription>
          </SheetHeader>
          <SidebarPanel collapsed={false} />
        </SheetContent>
      </Sheet>
    </>
  );
}
