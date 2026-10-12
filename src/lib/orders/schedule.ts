const KOLKATA = "Asia/Kolkata";

export function calendarDateInKolkata(at: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: KOLKATA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);
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
