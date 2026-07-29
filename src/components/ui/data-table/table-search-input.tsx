"use client";

import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";

export function TableSearchInput({
  value,
  onChange,
  placeholder,
  className,
  "aria-label": ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  "aria-label"?: string;
}) {
  return (
    <div className={`relative max-w-md flex-1 ${className ?? ""}`}>
      <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
      <Input
        placeholder={placeholder ?? "Search…"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 pl-9"
        aria-label={ariaLabel ?? "Search"}
      />
    </div>
  );
}
