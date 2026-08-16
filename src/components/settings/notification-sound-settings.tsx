"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Play, Volume2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  DEFAULT_ORDER_NOTIFICATION_SOUND,
  playOrderNotificationSound,
  type NotificationSound,
} from "@/lib/sounds/order-notification";
import { useSoundPreferenceStore } from "@/stores/sound-preference-store";

type SoundsResponse = {
  defaultPath: string;
  sounds: NotificationSound[];
};

export function NotificationSoundSettings() {
  const selected = useSoundPreferenceStore((s) => s.orderNotificationSound);
  const setSelected = useSoundPreferenceStore(
    (s) => s.setOrderNotificationSound,
  );
  const [playingPath, setPlayingPath] = React.useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["notification-sounds"],
    queryFn: async () => {
      const res = await fetch("/api/admin/notification-sounds");
      if (!res.ok) throw new Error("Failed to load sounds");
      return res.json() as Promise<SoundsResponse>;
    },
    staleTime: 60_000,
  });

  const sounds = data?.sounds ?? [];

  function handlePlay(path: string) {
    setPlayingPath(path);
    playOrderNotificationSound(path);
    window.setTimeout(() => setPlayingPath(null), 1500);
  }

  function handleSetDefault(path: string) {
    setSelected(path);
    toast.success("Default notification sound updated");
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">
          Order notification sound
        </h2>
        <p className="text-muted-foreground text-sm">
          Played when a new order arrives. Preview any sound, then set it as
          your default. Default is Beep Warning.
        </p>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Loading sounds…</p>
      ) : isError ? (
        <p className="text-destructive text-sm">Could not load sounds.</p>
      ) : (
        <ul className="divide-border max-h-[28rem] overflow-y-auto rounded-lg border">
          {sounds.map((sound) => {
            const isDefault =
              sound.path === DEFAULT_ORDER_NOTIFICATION_SOUND;
            const isSelected = sound.path === selected;
            const isPlaying = playingPath === sound.path;

            return (
              <li
                key={sound.path}
                className={cn(
                  "flex flex-wrap items-center gap-2 px-3 py-2.5 sm:flex-nowrap",
                  isSelected && "bg-muted/60",
                )}
              >
                <Volume2
                  className={cn(
                    "text-muted-foreground size-4 shrink-0",
                    isPlaying && "text-foreground animate-pulse",
                  )}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{sound.label}</p>
                  <p className="text-muted-foreground truncate font-mono text-xs">
                    {sound.relativePath}
                    {isDefault ? " · built-in default" : ""}
                  </p>
                </div>
                <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handlePlay(sound.path)}
                  >
                    <Play className="size-3.5" />
                    Play
                  </Button>
                  <Button
                    type="button"
                    variant={isSelected ? "default" : "secondary"}
                    size="sm"
                    onClick={() => handleSetDefault(sound.path)}
                    disabled={isSelected}
                  >
                    {isSelected ? (
                      <>
                        <Check className="size-3.5" />
                        Selected
                      </>
                    ) : (
                      "Set as default"
                    )}
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
