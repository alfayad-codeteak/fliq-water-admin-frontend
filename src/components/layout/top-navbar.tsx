"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { Bell, LogOut, Search, UserCircle } from "lucide-react";
import { toast } from "sonner";

import { clearAuthStorage } from "@/lib/auth-storage";
import { isSameNavTarget } from "@/lib/navigation";
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
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";

function initials(name?: string | null, phone?: string | null) {
  if (name?.trim()) {
    const parts = name.trim().split(/\s+/);
    return (parts[0]![0]! + (parts[1]?.[0] ?? "")).toUpperCase();
  }
  if (phone && phone.length >= 2) return phone.slice(-2).toUpperCase();
  return "PA";
}

export function TopNavbar() {
  const { data: session } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const setCommandOpen = useUiStore((s) => s.setCommandOpen);
  const [mobileSearchOpen, setMobileSearchOpen] = React.useState(false);

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
      className="sticky top-0 z-20 flex shrink-0 flex-col border-b bg-background/80 backdrop-blur-md"
      role="banner"
    >
      <div className="flex h-12 items-center gap-2 px-3 sm:h-14 sm:px-4 md:px-6">
        <SidebarTrigger aria-label="Open navigation menu" />
        <Separator orientation="vertical" className="mr-1 hidden h-6 sm:block" />
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <p className="truncate text-sm font-medium sm:hidden">Fliq Admin</p>
          <GlobalSearch className="hidden flex-1 sm:block" />
        </div>
        <div className="flex items-center gap-0.5 sm:gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="sm:hidden"
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
            size="icon-sm"
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
              className="ring-offset-background focus-visible:ring-ring inline-flex size-9 items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
              aria-label="User menu"
            >
              <Avatar className="size-8">
                <AvatarFallback>
                  {initials(session?.user?.name, session?.user?.phone)}
                </AvatarFallback>
              </Avatar>
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
                    <p className="text-muted-foreground text-xs">
                      Role: {session?.user?.role ?? "—"}
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
        <div className="border-t px-3 py-2 sm:hidden">
          <GlobalSearch className="w-full max-w-none" />
        </div>
      ) : null}
    </header>
  );
}
