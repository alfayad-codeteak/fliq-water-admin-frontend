const KOLKATA = "Asia/Kolkata";
const IST_OFFSET = "+05:30";

export const BOOKABLE_START_HOURS = [10, 11, 13, 15, 16, 17, 18, 19, 20] as const;

export function calendarDateInKolkata(at: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: KOLKATA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);
}

export function addCalendarDays(ymd: string, days: number): string {
  const utcNoon = Date.parse(`${ymd}T12:00:00.000Z`);
  const next = new Date(utcNoon + days * 24 * 60 * 60 * 1000);
  const y = next.getUTCFullYear();
  const m = String(next.getUTCMonth() + 1).padStart(2, "0");
  const d = String(next.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function ymdToPickerDate(ymd: string): Date {
  return new Date(`${ymd}T12:00:00${IST_OFFSET}`);
}

export function slotStartMs(ymd: string, hour: number): number {
  const hh = String(hour).padStart(2, "0");
  return Date.parse(`${ymd}T${hh}:00:00${IST_OFFSET}`);
}

/** Next India window that has not started yet. */
export function nextBookableYmdAndHour(now = new Date()): { date: string; startHour: number } {
  const today = calendarDateInKolkata(now);
  const nowMs = now.getTime();
  for (const hour of BOOKABLE_START_HOURS) {
    if (slotStartMs(today, hour) > nowMs) {
      return { date: today, startHour: hour };
    }
  }
  return { date: addCalendarDays(today, 1), startHour: BOOKABLE_START_HOURS[0] };
}

export function scheduledDateFromTimeSlot(
  timeSlot: string | null | undefined,
  createdAt: string | Date,
): string {
  const match = (timeSlot ?? "").trim().match(/^(\d{4}-\d{2}-\d{2})\b/);
  if (match) return match[1];
  return calendarDateInKolkata(new Date(createdAt));
}

export function isUpcomingScheduledDate(scheduledDate: string, now = new Date()): boolean {
  return scheduledDate > calendarDateInKolkata(now);
}

export function slotWindowLabel(timeSlot: string | null | undefined): string | null {
  const raw = (timeSlot ?? "").trim();
  if (!raw) return null;
  const dated = raw.match(/^\d{4}-\d{2}-\d{2}\s+(.+)$/);
  return dated ? dated[1] : raw;
}
