"use client";

import type { LucideIcon } from "lucide-react";

export type StatCardItem = {
  label: string;
  value: number | string;
  icon: LucideIcon;
};

export function TableStatCards({ items }: { items: StatCardItem[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <div
          key={item.label}
          className="bg-card flex items-center justify-between rounded-xl border px-4 py-3 shadow-sm"
        >
          <div>
            <p className="text-muted-foreground text-xs">{item.label}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {item.value}
            </p>
          </div>
          <div className="bg-muted text-muted-foreground flex size-9 items-center justify-center rounded-lg">
            <item.icon className="size-4" />
          </div>
        </div>
      ))}
    </div>
  );
}
