"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";

export function TablePagination({
  pageIndex,
  pageCount,
  pageSize,
  totalItems,
  itemLabel = "item",
  isFetching,
  onPageSizeChange,
  onPrevious,
  onNext,
  canPrevious,
  canNext,
}: {
  pageIndex: number;
  pageCount: number;
  pageSize: number;
  totalItems: number;
  itemLabel?: string;
  isFetching?: boolean;
  onPageSizeChange?: (size: number) => void;
  onPrevious: () => void;
  onNext: () => void;
  canPrevious: boolean;
  canNext: boolean;
}) {
  const plural = totalItems === 1 ? itemLabel : `${itemLabel}s`;

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="text-muted-foreground flex flex-wrap items-center gap-3 text-sm">
        <span>
          {totalItems} {plural}
        </span>
        {isFetching ? <span className="text-xs">Refreshing…</span> : null}
        {onPageSizeChange ? (
          <label className="flex items-center gap-2 text-xs">
            Rows
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="border-input bg-background h-7 rounded-md border px-2"
            >
              {[8, 10, 20, 50].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground text-sm">
          Page {pageIndex + 1} of {pageCount || 1}
        </span>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          onClick={onPrevious}
          disabled={!canPrevious}
          aria-label="Previous page"
        >
          <ChevronLeft className="size-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          onClick={onNext}
          disabled={!canNext}
          aria-label="Next page"
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}
