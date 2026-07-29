"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { TableCell, TableRow } from "@/components/ui/table";

export function TableSkeletonRows({
  rows = 6,
  colSpan,
}: {
  rows?: number;
  colSpan: number;
}) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <TableRow key={`sk-${i}`}>
          <TableCell colSpan={colSpan}>
            <div className="flex items-center gap-3 py-1">
              <Skeleton className="size-9 rounded-md" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}
