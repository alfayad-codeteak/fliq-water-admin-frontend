"use client";

import { cn } from "@/lib/utils";

export type FilterChip = {
  id: string;
  label: string;
  count?: number;
};

export function TableFilterChips({
  chips,
  activeId,
  onChange,
}: {
  chips: FilterChip[];
  activeId: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {chips.map((chip) => (
        <button
          key={chip.id}
          type="button"
          onClick={() => onChange(chip.id)}
          className={cn(
            "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors",
            activeId === chip.id
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-background hover:bg-muted text-muted-foreground"
          )}
        >
          {chip.label}
          {chip.count !== undefined ? (
            <span
              className={cn(
                "rounded-full px-1.5 py-0.5 text-[10px] tabular-nums",
                activeId === chip.id
                  ? "bg-primary-foreground/15"
                  : "bg-muted"
              )}
            >
              {chip.count}
            </span>
          ) : null}
        </button>
      ))}
    </div>
  );
}
