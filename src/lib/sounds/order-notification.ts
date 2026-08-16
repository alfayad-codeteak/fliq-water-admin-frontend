export const DEFAULT_ORDER_NOTIFICATION_SOUND =
  "/sounds/beep-warning-6387.mp3";

export const ORDER_NOTIFICATION_SOUND_KEY =
  "neerbottle.orderNotificationSound";

export type NotificationSound = {
  /** Public URL path, e.g. `/sounds/ding.mp3` */
  path: string;
  /** Relative path under `public/sounds`, e.g. `ding.mp3` */
  relativePath: string;
  label: string;
};

/** Turn a filename into a readable label. */
export function soundFileLabel(relativePath: string): string {
  const base = relativePath.split("/").pop() ?? relativePath;
  const withoutExt = base.replace(/\.[^.]+$/, "");
  const cleaned = withoutExt
    .replace(/^\d+-?/, "")
    .replace(/^mixkit[-_]?/i, "")
    .replace(/\s*\(\d+\)\s*$/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) return base;

  return cleaned.replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Encode each path segment so spaces in filenames work. */
export function soundPublicUrl(relativePath: string): string {
  const encoded = relativePath
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `/sounds/${encoded}`;
}

export function getStoredOrderNotificationSound(): string {
  if (typeof window === "undefined") return DEFAULT_ORDER_NOTIFICATION_SOUND;
  try {
    const stored = localStorage.getItem(ORDER_NOTIFICATION_SOUND_KEY);
    if (stored && stored.startsWith("/sounds/")) return stored;
  } catch {
    /* ignore */
  }
  return DEFAULT_ORDER_NOTIFICATION_SOUND;
}

export function setStoredOrderNotificationSound(path: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(ORDER_NOTIFICATION_SOUND_KEY, path);
  } catch {
    /* ignore */
  }
}

let sharedAudio: HTMLAudioElement | null = null;

export function playOrderNotificationSound(path?: string): void {
  if (typeof window === "undefined") return;
  const src = path ?? getStoredOrderNotificationSound();
  try {
    if (!sharedAudio) {
      sharedAudio = new Audio();
    }
    sharedAudio.pause();
    sharedAudio.currentTime = 0;
    sharedAudio.src = src;
    sharedAudio.volume = 1;
    void sharedAudio.play().catch(() => {
      /* Autoplay may be blocked until a user gesture */
    });
  } catch {
    /* ignore */
  }
}

/** Unlock audio after the first click/keydown so later notifications can play. */
export function unlockOrderNotificationAudio(): void {
  if (typeof window === "undefined") return;
  try {
    if (!sharedAudio) sharedAudio = new Audio();
    sharedAudio.muted = true;
    void sharedAudio
      .play()
      .then(() => {
        sharedAudio?.pause();
        if (sharedAudio) {
          sharedAudio.muted = false;
          sharedAudio.currentTime = 0;
        }
      })
      .catch(() => {
        if (sharedAudio) sharedAudio.muted = false;
      });
  } catch {
    /* ignore */
  }
}
