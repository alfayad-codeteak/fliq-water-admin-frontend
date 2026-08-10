"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronRight, LogOut, Settings } from "lucide-react";

import { cn } from "@/lib/utils";

export type NavItemData = {
  id: string;
  title: string;
  icon: React.ElementType;
  href?: string;
  badge?: number | string;
  shortcut?: string;
  children?: NavItemData[];
};

export type NavGroupData = {
  heading?: string;
  items: NavItemData[];
};

type BrandProps = {
  name?: string;
  subtitle?: string;
  logoSrc?: string;
  href?: string;
};

function BrandHeader({
  name = "Neerbottle",
  subtitle = "ADMIN",
  logoSrc = "/neerbottle-admin-icon.avif",
  href = "/dashboard",
  onNavigate,
}: BrandProps & { onNavigate?: (href: string) => void }) {
  const content = (
    <>
      <div className="relative size-9 shrink-0 overflow-hidden rounded-[8px] shadow-sm ring-1 ring-border/40">
        <Image
          src={logoSrc}
          alt={`${name} Admin`}
          fill
          className="object-cover"
          sizes="36px"
          priority
        />
      </div>
      <div className="flex min-w-0 flex-col overflow-hidden">
        <span className="truncate text-[14px] font-semibold leading-none tracking-tight text-foreground">
          {name}
        </span>
        <span className="mt-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-primary">
          {subtitle}
        </span>
      </div>
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        onClick={(e) => {
          if (onNavigate) {
            e.preventDefault();
            onNavigate(href);
          }
        }}
        className="mb-4 flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-black/5 dark:hover:bg-white/5"
      >
        {content}
      </Link>
    );
  }

  return (
    <div className="mb-4 flex items-center gap-3 rounded-lg px-2 py-2">{content}</div>
  );
}

function NavItem({
  item,
  activeId,
  onSelect,
  onNavigate,
  level = 0,
}: {
  item: NavItemData;
  activeId: string;
  onSelect: (id: string) => void;
  onNavigate?: (href: string) => void;
  level?: number;
}) {
  const isActive = activeId === item.id;
  const hasChildren = !!item.children?.length;
  const [isOpen, setIsOpen] = React.useState(
    () => !!item.children?.some((c) => c.id === activeId)
  );

  React.useEffect(() => {
    if (item.children?.some((c) => c.id === activeId)) {
      setIsOpen(true);
    }
  }, [activeId, item.children]);

  const handleClick = () => {
    if (hasChildren) {
      setIsOpen((open) => !open);
      return;
    }
    onSelect(item.id);
    if (item.href) onNavigate?.(item.href);
  };

  const rowClassName = cn(
    "group flex w-full cursor-pointer items-center justify-between rounded-[6px] px-2.5 py-[7px] transition-all duration-200 select-none",
    isActive
      ? "bg-black/5 font-medium text-foreground dark:bg-white/10"
      : "text-muted-foreground hover:bg-black/5 hover:text-foreground/90 dark:hover:bg-white/5"
  );

  const rowStyle = { paddingLeft: `${level * 12 + 10}px` };

  const rowInner = (
    <>
      <div className="flex min-w-0 items-center gap-2.5">
        <item.icon
          className={cn(
            "size-4 shrink-0 transition-colors",
            isActive
              ? "text-foreground"
              : "text-muted-foreground/70 group-hover:text-foreground/70"
          )}
          strokeWidth={1.5}
          aria-hidden
        />
        <span className="truncate text-[13px] tracking-wide">{item.title}</span>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {item.shortcut ? (
          <kbd className="shadow-xs hidden h-5 items-center justify-center rounded-[4px] border border-border/50 bg-background/50 px-1.5 font-mono text-[10px] font-medium text-muted-foreground/60 group-hover:inline-flex">
            {item.shortcut}
          </kbd>
        ) : null}
        {item.badge != null ? (
          <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary/10 px-1.5 text-[10px] font-medium text-primary">
            {item.badge}
          </span>
        ) : null}
        {hasChildren ? (
          <ChevronRight
            className={cn(
              "size-3.5 text-muted-foreground/50 transition-transform duration-200",
              isOpen && "rotate-90"
            )}
            strokeWidth={2}
            aria-hidden
          />
        ) : null}
      </div>
    </>
  );

  return (
    <div className="flex w-full flex-col">
      {item.href && !hasChildren ? (
        <Link
          href={item.href}
          className={rowClassName}
          style={rowStyle}
          onClick={(e) => {
            e.preventDefault();
            handleClick();
          }}
        >
          {rowInner}
        </Link>
      ) : (
        <div
          className={rowClassName}
          style={rowStyle}
          onClick={handleClick}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              handleClick();
            }
          }}
        >
          {rowInner}
        </div>
      )}

      {hasChildren ? (
        <div
          className={cn(
            "grid transition-[grid-template-rows,opacity] duration-300 ease-in-out",
            isOpen
              ? "grid-rows-[1fr] opacity-100"
              : "grid-rows-[0fr] opacity-0"
          )}
        >
          <div className="relative mt-0.5 flex min-h-0 flex-col gap-0.5 overflow-hidden">
            <div
              className="absolute top-0 bottom-0 border-l border-black/5 dark:border-white/5"
              style={{ left: `${level * 12 + 17.5}px` }}
            />
            {item.children!.map((child) => (
              <NavItem
                key={child.id}
                item={child}
                activeId={activeId}
                onSelect={onSelect}
                onNavigate={onNavigate}
                level={level + 1}
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function SidebarNav({
  className = "",
  activeId,
  onSelect,
  onNavigate,
  navGroups,
  bottomItems,
  brand,
}: {
  className?: string;
  activeId?: string;
  onSelect?: (id: string) => void;
  onNavigate?: (href: string) => void;
  navGroups: NavGroupData[];
  bottomItems?: NavItemData[];
  brand?: BrandProps;
}) {
  const [internalId, setInternalId] = React.useState(activeId ?? "dashboard");
  const currentId = activeId !== undefined ? activeId : internalId;
  const handleSelect = onSelect ?? setInternalId;

  const footerItems =
    bottomItems ??
    ([
      { id: "settings", title: "Settings", icon: Settings, href: "/settings" },
      { id: "logout", title: "Log out", icon: LogOut },
    ] satisfies NavItemData[]);

  return (
    <div
      className={cn(
        "flex h-full w-[260px] flex-col border-r border-border/50 bg-card/50 p-3 font-sans",
        className
      )}
    >
      <BrandHeader {...brand} onNavigate={onNavigate} />

      <div className="mt-2 flex flex-1 flex-col gap-4 overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {navGroups.map((group, idx) => (
          <div key={group.heading ?? idx} className="flex flex-col gap-0.5">
            {group.heading ? (
              <span className="mb-1 px-2.5 text-[11px] font-semibold tracking-wider text-muted-foreground/50 uppercase">
                {group.heading}
              </span>
            ) : null}
            {group.items.map((item) => (
              <NavItem
                key={item.id}
                item={item}
                activeId={currentId}
                onSelect={handleSelect}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        ))}
      </div>

      <div className="mt-auto flex flex-col gap-0.5 border-t border-border/50 pt-4">
        {footerItems.map((item) => (
          <NavItem
            key={item.id}
            item={item}
            activeId={currentId}
            onSelect={handleSelect}
            onNavigate={onNavigate}
          />
        ))}
      </div>
    </div>
  );
}
