"use client";

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

export function SortHeader({
  label,
  sorted,
  onToggle,
}: {
  label: string;
  sorted: false | "asc" | "desc";
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      className="hover:text-foreground -ml-1 inline-flex items-center gap-1.5 rounded px-1 py-0.5 font-medium transition-colors"
      onClick={onToggle}
    >
      {label}
      {sorted === "asc" ? (
        <ArrowUp className="size-3.5" />
      ) : sorted === "desc" ? (
        <ArrowDown className="size-3.5" />
      ) : (
        <ArrowUpDown className="size-3.5 opacity-40" />
      )}
    </button>
  );
}
