"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

const SIZE_CLASS = {
  sm: "sm:max-w-md",
  md: "sm:max-w-lg",
  lg: "sm:max-w-xl",
  xl: "sm:max-w-2xl",
  "2xl": "sm:max-w-3xl",
  wide: "sm:max-w-5xl",
} as const;

export type RightSidebarSize = keyof typeof SIZE_CLASS;

type RightSidebarProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  size?: RightSidebarSize;
  className?: string;
  /** Extra classes for the scrollable body. */
  bodyClassName?: string;
  showCloseButton?: boolean;
};

/**
 * Right-edge form drawer used for create / edit flows across the admin app.
 */
export function RightSidebar({
  open,
  onOpenChange,
  title,
  description,
  children,
  size = "md",
  className,
  bodyClassName,
  showCloseButton = true,
}: RightSidebarProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        showCloseButton={showCloseButton}
        className={cn(
          "data-[side=right]:w-full data-[side=right]:gap-0 data-[side=right]:p-0",
          SIZE_CLASS[size],
          className
        )}
      >
        <SheetHeader className="border-border shrink-0 space-y-1 border-b px-5 py-4 pr-12 text-left">
          <SheetTitle className="text-base sm:text-lg">{title}</SheetTitle>
          {description ? (
            <SheetDescription>{description}</SheetDescription>
          ) : null}
        </SheetHeader>
        <div
          className={cn(
            "min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4",
            bodyClassName
          )}
        >
          {children}
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** Sticky action row for forms inside {@link RightSidebar}. */
export function RightSidebarActions({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      data-slot="right-sidebar-actions"
      className={cn(
        "border-border bg-background sticky bottom-0 -mx-5 -mb-4 mt-6 flex flex-col-reverse gap-2 border-t px-5 py-4 sm:flex-row sm:justify-end",
        className
      )}
    >
      {children}
    </div>
  );
}
