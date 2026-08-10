"use client";

import * as React from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isBefore,
  isSameDay,
  isSameMonth,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { CalendarDays, ChevronLeft, ChevronRight, Clock } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const PRESETS = [
  { id: "morning", label: "Morning", start: "10:00", end: "12:00" },
  { id: "afternoon", label: "Afternoon", start: "14:00", end: "16:00" },
  { id: "evening", label: "Evening", start: "18:00", end: "20:00" },
] as const;

function toYmd(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

function parseYmd(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Builds API `timeSlot` string: `YYYY-MM-DD HH:mm-HH:mm`. */
export function buildDeliveryTimeSlot(
  date: string,
  startTime: string,
  endTime: string
): string {
  return `${date} ${startTime}-${endTime}`;
}

export function defaultDeliverySlotParts(now = new Date()): {
  date: string;
  startTime: string;
  endTime: string;
} {
  return {
    date: toYmd(now),
    startTime: "10:00",
    endTime: "12:00",
  };
}

type DeliverySlotPickerProps = {
  date: string;
  startTime: string;
  endTime: string;
  onChange: (next: {
    date: string;
    startTime: string;
    endTime: string;
  }) => void;
  className?: string;
};

export function DeliverySlotPicker({
  date,
  startTime,
  endTime,
  onChange,
  className,
}: DeliverySlotPickerProps) {
  const selected = parseYmd(date) ?? startOfDay(new Date());
  const [month, setMonth] = React.useState(() => startOfMonth(selected));
  const today = startOfDay(new Date());

  React.useEffect(() => {
    const d = parseYmd(date);
    if (d) setMonth(startOfMonth(d));
  }, [date]);

  const days = React.useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [month]);

  const activePreset = PRESETS.find(
    (p) => p.start === startTime && p.end === endTime
  )?.id;

  const summary = buildDeliveryTimeSlot(date, startTime, endTime);
  const invalidRange =
    Boolean(startTime && endTime) && startTime >= endTime;

  return (
    <div className={cn("grid gap-3", className)}>
      <div className="flex items-center justify-between gap-2">
        <Label className="inline-flex items-center gap-1.5">
          <CalendarDays className="text-muted-foreground size-3.5" />
          Delivery date &amp; time
        </Label>
        <p className="text-muted-foreground font-mono text-xs tabular-nums">
          {summary}
        </p>
      </div>

      <div className="rounded-lg border">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Previous month"
            onClick={() => setMonth((m) => addMonths(m, -1))}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <p className="text-sm font-medium">{format(month, "MMMM yyyy")}</p>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Next month"
            onClick={() => setMonth((m) => addMonths(m, 1))}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>

        <div className="grid grid-cols-7 gap-0.5 px-2 pt-2 text-center text-[0.7rem] font-medium text-muted-foreground">
          {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
            <div key={d} className="py-1">
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-0.5 p-2">
          {days.map((day) => {
            const inMonth = isSameMonth(day, month);
            const isSelected = isSameDay(day, selected);
            const isPast = isBefore(day, today);
            return (
              <button
                key={day.toISOString()}
                type="button"
                disabled={isPast}
                onClick={() =>
                  onChange({
                    date: toYmd(day),
                    startTime,
                    endTime,
                  })
                }
                className={cn(
                  "h-8 rounded-md text-sm tabular-nums transition-colors",
                  !inMonth && "text-muted-foreground/40",
                  inMonth && !isSelected && "hover:bg-muted",
                  isSelected &&
                    "bg-primary text-primary-foreground hover:bg-primary",
                  isPast && "cursor-not-allowed opacity-40 hover:bg-transparent"
                )}
              >
                {format(day, "d")}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() =>
              onChange({ date, startTime: p.start, endTime: p.end })
            }
            className={cn(
              "rounded-md border px-2.5 py-1 text-xs transition-colors",
              activePreset === p.id
                ? "border-primary bg-primary/10 text-foreground font-medium"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {p.label} · {p.start}–{p.end}
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="slot-start" className="inline-flex items-center gap-1.5">
            <Clock className="text-muted-foreground size-3.5" />
            Start
          </Label>
          <Input
            id="slot-start"
            type="time"
            value={startTime}
            onChange={(e) =>
              onChange({ date, startTime: e.target.value, endTime })
            }
            required
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="slot-end" className="inline-flex items-center gap-1.5">
            <Clock className="text-muted-foreground size-3.5" />
            End
          </Label>
          <Input
            id="slot-end"
            type="time"
            value={endTime}
            onChange={(e) =>
              onChange({ date, startTime, endTime: e.target.value })
            }
            required
          />
        </div>
      </div>

      {invalidRange ? (
        <p className="text-destructive text-xs">
          End time must be after start time.
        </p>
      ) : null}
    </div>
  );
}
