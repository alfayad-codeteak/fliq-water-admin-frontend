"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

import { useUiStore } from "@/stores/ui-store";

const NAV_TIMEOUT_MS = 15_000;

export function NavigationProgress() {
  const pathname = usePathname();
  const navigationPending = useUiStore((s) => s.navigationPending);
  const setNavigationPending = useUiStore((s) => s.setNavigationPending);
  const prevPathRef = React.useRef(pathname);

  React.useEffect(() => {
    if (prevPathRef.current !== pathname) {
      prevPathRef.current = pathname;
      setNavigationPending(false);
    }
  }, [pathname, setNavigationPending]);

  React.useEffect(() => {
    if (!navigationPending) return;
    const id = window.setTimeout(
      () => setNavigationPending(false),
      NAV_TIMEOUT_MS
    );
    return () => window.clearTimeout(id);
  }, [navigationPending, setNavigationPending]);

  if (!navigationPending) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-1 overflow-hidden bg-muted"
      role="progressbar"
      aria-busy="true"
      aria-label="Loading page"
    >
      <div className="nav-indeterminate-bar h-full w-[45%] bg-primary" />
    </div>
  );
}
