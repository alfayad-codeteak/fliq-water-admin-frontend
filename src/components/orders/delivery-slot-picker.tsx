"use client";

import * as React from "react";
import {
  addDays,
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
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

const SLOT_START_HOUR = 8;
const SLOT_END_HOUR = 22; // last slot is 21:00–22:00

export type HourSlot = {
  id: string;
  start: string;
  end: string;
  label: string;
  startHour: number;
};

function toYmd(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

function parseYmd(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function hourToHm(hour: number): string {
  return `${pad2(hour)}:00`;
}

function formatSlotLabel(startHour: number): string {
  const endHour = startHour + 1;
  const startPeriod = startHour >= 12 ? "PM" : "AM";
  const endPeriod = endHour >= 12 && endHour < 24 ? "PM" : "AM";
  const start12 = startHour % 12 === 0 ? 12 : startHour % 12;
  const end12 = endHour % 12 === 0 ? 12 : endHour % 12;
  if (startPeriod === endPeriod) {
    return `${start12}–${end12} ${endPeriod}`;
  }
  return `${start12} ${startPeriod}–${end12} ${endPeriod}`;
}

function nextSlotStartHour(now: Date): number {
  const minutes = now.getMinutes();
  const hour = now.getHours();
  return minutes > 0 ? hour + 1 : hour;
}

function buildHourSlots(date: string, now = new Date()): HourSlot[] {
  const selected = parseYmd(date);
  const today = startOfDay(now);
  const isToday = selected ? isSameDay(selected, today) : true;
  const firstHour = isToday
    ? Math.max(SLOT_START_HOUR, nextSlotStartHour(now))
    : SLOT_START_HOUR;

  const slots: HourSlot[] = [];
  for (let hour = firstHour; hour < SLOT_END_HOUR; hour += 1) {
    slots.push({
      id: `${hour}`,
      startHour: hour,
      start: hourToHm(hour),
      end: hourToHm(hour + 1),
      label: formatSlotLabel(hour),
    });
  }
  return slots;
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
  const todaySlots = buildHourSlots(toYmd(now), now);
  if (todaySlots[0]) {
    return {
      date: toYmd(now),
      startTime: todaySlots[0].start,
      endTime: todaySlots[0].end,
    };
  }
  const tomorrow = addDays(startOfDay(now), 1);
  const tomorrowSlots = buildHourSlots(toYmd(tomorrow), now);
  const first = tomorrowSlots[0];
  return {
    date: toYmd(tomorrow),
    startTime: first?.start ?? "08:00",
    endTime: first?.end ?? "09:00",
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
  const slots = React.useMemo(() => buildHourSlots(date), [date]);

  React.useEffect(() => {
    const d = parseYmd(date);
    if (d) setMonth(startOfMonth(d));
  }, [date]);

  const days = React.useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [month]);

  const activeSlotId = slots.find(
    (s) => s.start === startTime && s.end === endTime
  )?.id;

  const summary = buildDeliveryTimeSlot(date, startTime, endTime);

  function pickDate(day: Date) {
    const nextDate = toYmd(day);
    const nextSlots = buildHourSlots(nextDate);
    const keep = nextSlots.find(
      (s) => s.start === startTime && s.end === endTime
    );
    const fallback = nextSlots[0];
    onChange({
      date: nextDate,
      startTime: keep?.start ?? fallback?.start ?? startTime,
      endTime: keep?.end ?? fallback?.end ?? endTime,
    });
  }

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
                onClick={() => pickDate(day)}
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

      <div className="grid gap-1.5">
        <p className="text-muted-foreground text-xs">
          {isSameDay(selected, today)
            ? "1-hour slots from now"
            : "1-hour slots"}
        </p>
        {slots.length === 0 ? (
          <p className="text-muted-foreground rounded-md border border-dashed px-3 py-2 text-xs">
            No remaining slots today. Pick tomorrow or a later date.
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {slots.map((slot) => (
              <button
                key={slot.id}
                type="button"
                onClick={() =>
                  onChange({
                    date,
                    startTime: slot.start,
                    endTime: slot.end,
                  })
                }
                className={cn(
                  "rounded-md border px-2.5 py-1.5 text-xs tabular-nums transition-colors",
                  activeSlotId === slot.id
                    ? "border-primary bg-primary/10 text-foreground font-medium"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                {slot.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
