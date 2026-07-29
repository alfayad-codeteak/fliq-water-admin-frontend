"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useUiStore } from "@/stores/ui-store";
import { isSameNavTarget } from "@/lib/navigation";
import { Bell, LogOut, Moon, Search, Sun, UserCircle } from "lucide-react";
import { useTheme } from "next-themes";
import { toast } from "sonner";

import { clearAuthStorage } from "@/lib/auth-storage";
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
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";

function initials(name?: string | null, phone?: string | null) {
  if (name?.trim()) {
    const parts = name.trim().split(/\s+/);
    return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
  }
  if (phone && phone.length >= 2) return phone.slice(-2).toUpperCase();
  return "PA";
}

export function TopNavbar() {
  const { data: session } = useSession();
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const setCommandOpen = useUiStore((s) => s.setCommandOpen);
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCommandOpen(true);
        toast.message("Command palette", {
          description: "Hook this shortcut to search or navigation.",
        });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setCommandOpen]);

  return (
    <header
      className="sticky top-0 z-20 flex h-12 shrink-0 items-center gap-2 border-b bg-background/80 px-3 backdrop-blur-md sm:h-14 sm:px-4 md:px-6"
      role="banner"
    >
      <SidebarTrigger aria-label="Open navigation menu" />
      <Separator orientation="vertical" className="mr-1 hidden h-6 sm:block" />
      <div className="flex flex-1 items-center gap-3">
        <p className="truncate text-sm font-medium sm:hidden">Fliq Admin</p>
        <div className="relative hidden max-w-md flex-1 sm:block">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="search"
            placeholder="Search…"
            className="h-9 pl-9"
            aria-label="Search"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                toast.info("Search is not connected yet.");
              }
            }}
          />
        </div>
      </div>
      <div className="flex items-center gap-0.5 sm:gap-1">
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
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={
            mounted && theme === "dark"
              ? "Switch to light mode"
              : "Switch to dark mode"
          }
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
          {mounted && theme === "dark" ? (
            <Sun className="size-4" />
          ) : (
            <Moon className="size-4" />
          )}
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
                  <p className="text-sm font-medium leading-none">
                    {session?.user?.name ?? "User"}
                  </p>
                  <p className="text-xs leading-none text-muted-foreground font-mono">
                    {session?.user?.phone}
                  </p>
                  <p className="text-xs text-muted-foreground">
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
              className="cursor-pointer text-destructive focus:text-destructive"
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
    </header>
  );
}
