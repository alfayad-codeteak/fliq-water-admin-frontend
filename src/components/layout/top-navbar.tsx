"use client";

import * as React from "react";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { Bell, LogOut, Menu, Search, UserCircle } from "lucide-react";
import { toast } from "sonner";

import { titleFromPath } from "@/lib/admin-nav";
import { clearAuthStorage } from "@/lib/auth-storage";
import { isSameNavTarget } from "@/lib/navigation";
import { useShellStore } from "@/stores/shell-store";
import { useUiStore } from "@/stores/ui-store";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { GlobalSearch } from "@/components/layout/global-search";

function initials(name?: string | null, phone?: string | null) {
  if (name?.trim()) {
    const parts = name.trim().split(/\s+/);
    return (parts[0]![0]! + (parts[1]?.[0] ?? "")).toUpperCase();
  }
  if (phone && phone.length >= 2) return phone.slice(-2).toUpperCase();
  return "NB";
}

export function TopNavbar() {
  const { data: session } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const setCommandOpen = useUiStore((s) => s.setCommandOpen);
  const setMobileOpen = useShellStore((s) => s.setMobileOpen);
  const [mobileSearchOpen, setMobileSearchOpen] = React.useState(false);
  const pageTitle = titleFromPath(pathname);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCommandOpen(true);
        setMobileSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setCommandOpen]);

  return (
    <header
      className="z-30 flex w-full shrink-0 flex-col border-b border-slate-200/80 bg-white"
      role="banner"
    >
      <div className="flex h-14 w-full items-center gap-3 px-3 sm:h-16 sm:px-5">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="lg:hidden"
          aria-label="Open menu"
          onClick={() => setMobileOpen(true)}
        >
          <Menu className="size-5" />
        </Button>

        <div className="flex min-w-0 items-center gap-2.5">
          <div className="relative size-8 shrink-0 overflow-hidden rounded-lg bg-sky-600 shadow-sm ring-1 ring-slate-200">
            <Image
              src="/neerbottle-admin-icon.avif"
              alt=""
              fill
              className="object-cover"
              sizes="32px"
            />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold tracking-tight text-slate-900">
              Neerbottle
            </p>
            <p className="hidden text-[10px] font-bold tracking-[0.18em] text-sky-700 uppercase sm:block">
              Admin
            </p>
          </div>
        </div>

        <div className="mx-2 hidden h-6 w-px bg-slate-200 sm:block" />

        <p className="hidden min-w-0 truncate text-sm font-bold text-slate-800 md:block">
          {pageTitle}
        </p>

        <div className="hidden min-w-0 flex-1 justify-center px-4 lg:flex">
          <GlobalSearch className="w-full max-w-xl" />
        </div>

        <div className="ml-auto flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="lg:hidden"
            aria-label="Search"
            onClick={() => {
              setMobileSearchOpen((v) => !v);
              setCommandOpen(true);
            }}
          >
            <Search className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="hidden sm:inline-flex"
            aria-label="Notifications"
            onClick={() =>
              toast.success("You are all caught up.", {
                description: "No new notifications.",
              })
            }
          >
            <Bell className="size-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger
              className="ring-offset-background focus-visible:ring-ring inline-flex items-center gap-2 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
              aria-label="User menu"
            >
              <Avatar className="size-8">
                <AvatarFallback className="bg-sky-100 text-xs font-semibold text-sky-800">
                  {initials(session?.user?.name, session?.user?.phone)}
                </AvatarFallback>
              </Avatar>
              <span className="hidden max-w-[140px] truncate text-left text-sm font-bold text-slate-800 xl:block">
                {session?.user?.name ?? "Account"}
              </span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuGroup>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm leading-none font-medium">
                      {session?.user?.name ?? "User"}
                    </p>
                    <p className="text-muted-foreground font-mono text-xs leading-none">
                      {session?.user?.phone}
                    </p>
                    <p className="text-muted-foreground text-xs capitalize">
                      {session?.user?.role ?? "—"}
                    </p>
                  </div>
                </DropdownMenuLabel>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="cursor-pointer"
                onClick={() => {
                  if (!isSameNavTarget(pathname, "/settings")) {
                    useUiStore.getState().setNavigationPending(true);
                  }
                  router.push("/settings");
                }}
              >
                <UserCircle className="mr-2 size-4" />
                Profile & settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive cursor-pointer"
                onClick={async () => {
                  clearAuthStorage();
                  await signOut({ redirectTo: "/login" });
                  router.push("/login");
                }}
              >
                <LogOut className="mr-2 size-4" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      {mobileSearchOpen ? (
        <div className="border-t px-3 py-2 lg:hidden">
          <GlobalSearch className="w-full max-w-none" />
        </div>
      ) : null}
    </header>
  );
}
