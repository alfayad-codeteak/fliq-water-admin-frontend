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
let audioCtx: AudioContext | null = null;
let fallbackToken = 0;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctx =
    window.AudioContext ||
    (window as Window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctx) return null;
  if (!audioCtx) audioCtx = new Ctx();
  return audioCtx;
}

/** Short two-tone beep if the selected file is missing or autoplay fails. */
export function playWebAudioBeep(): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  void ctx.resume().catch(() => undefined);

  const now = ctx.currentTime;
  const master = ctx.createGain();
  master.gain.setValueAtTime(0.0001, now);
  master.gain.exponentialRampToValueAtTime(0.22, now + 0.02);
  master.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);
  master.connect(ctx.destination);

  const tones = [
    { freq: 880, start: 0, dur: 0.18 },
    { freq: 1320, start: 0.2, dur: 0.28 },
  ];
  for (const tone of tones) {
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(tone.freq, now + tone.start);
    osc.connect(master);
    osc.start(now + tone.start);
    osc.stop(now + tone.start + tone.dur);
  }
}

function playHtmlAudio(src: string, onFail: () => void): void {
  if (!sharedAudio) {
    sharedAudio = new Audio();
  }
  const audio = sharedAudio;
  audio.pause();
  audio.currentTime = 0;
  audio.muted = false;
  audio.volume = 1;

  const failOnce = () => {
    audio.removeEventListener("error", failOnce);
    onFail();
  };
  audio.addEventListener("error", failOnce, { once: true });
  audio.src = src;
  void audio.play().then(
    () => audio.removeEventListener("error", failOnce),
    () => {
      audio.removeEventListener("error", failOnce);
      onFail();
    },
  );
}

export function playOrderNotificationSound(path?: string): void {
  if (typeof window === "undefined") return;
  const src = path ?? getStoredOrderNotificationSound();
  const token = ++fallbackToken;
  try {
    playHtmlAudio(src, () => {
      if (token === fallbackToken) playWebAudioBeep();
    });
  } catch {
    playWebAudioBeep();
  }
}

/** Unlock audio after the first click/keydown so later notifications can play. */
export function unlockOrderNotificationAudio(): void {
  if (typeof window === "undefined") return;
  const ctx = getAudioContext();
  if (ctx && ctx.state === "suspended") {
    void ctx.resume().catch(() => undefined);
  }
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
