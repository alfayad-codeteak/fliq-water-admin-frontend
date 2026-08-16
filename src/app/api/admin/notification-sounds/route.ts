import { readdir } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";

import { auth } from "@/auth";
import {
  DEFAULT_ORDER_NOTIFICATION_SOUND,
  soundFileLabel,
  soundPublicUrl,
  type NotificationSound,
} from "@/lib/sounds/order-notification";

const AUDIO_EXT = new Set([".mp3", ".wav", ".ogg", ".m4a", ".aac"]);

async function walkSounds(
  dir: string,
  baseDir: string,
): Promise<NotificationSound[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const sounds: NotificationSound[] = [];

  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      sounds.push(...(await walkSounds(full, baseDir)));
      continue;
    }
    if (!entry.isFile()) continue;
    const ext = path.extname(entry.name).toLowerCase();
    if (!AUDIO_EXT.has(ext)) continue;

    const relativePath = path.relative(baseDir, full).split(path.sep).join("/");
    sounds.push({
      relativePath,
      path: soundPublicUrl(relativePath),
      label: soundFileLabel(relativePath),
    });
  }

  return sounds;
}

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const soundsDir = path.join(process.cwd(), "public", "sounds");

  try {
    const sounds = await walkSounds(soundsDir, soundsDir);
    sounds.sort((a, b) => {
      if (a.path === DEFAULT_ORDER_NOTIFICATION_SOUND) return -1;
      if (b.path === DEFAULT_ORDER_NOTIFICATION_SOUND) return 1;
      return a.label.localeCompare(b.label);
    });

    return NextResponse.json({
      defaultPath: DEFAULT_ORDER_NOTIFICATION_SOUND,
      sounds,
    });
  } catch (error) {
    console.error("Failed to list notification sounds", error);
    return NextResponse.json(
      {
        defaultPath: DEFAULT_ORDER_NOTIFICATION_SOUND,
        sounds: [
          {
            relativePath: "beep-warning-6387.mp3",
            path: DEFAULT_ORDER_NOTIFICATION_SOUND,
            label: "Beep Warning",
          },
        ] satisfies NotificationSound[],
      },
      { status: 200 },
    );
  }
}
