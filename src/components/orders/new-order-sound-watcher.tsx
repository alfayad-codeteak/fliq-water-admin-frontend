"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";

import { clientFetch } from "@/lib/api/client-fetch";
import type { OrderDto } from "@/lib/api/types";
import {
  playOrderNotificationSound,
  unlockOrderNotificationAudio,
} from "@/lib/sounds/order-notification";
import { useSoundPreferenceStore } from "@/stores/sound-preference-store";

const POLL_MS = 20_000;

/**
 * Polls orders in the background and plays the admin's preferred
 * notification sound when new order IDs appear.
 */
export function NewOrderSoundWatcher() {
  const { status } = useSession();
  const soundPath = useSoundPreferenceStore((s) => s.orderNotificationSound);
  const knownIdsRef = React.useRef<Set<string> | null>(null);
  const primedRef = React.useRef(false);

  React.useEffect(() => {
    const unlock = () => unlockOrderNotificationAudio();
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  const { data: orders } = useQuery({
    queryKey: ["admin-orders"],
    queryFn: async () => {
      const res = await clientFetch("/api/bff/admin/orders");
      if (!res.ok) throw new Error("Failed to load orders");
      return res.json() as Promise<OrderDto[]>;
    },
    enabled: status === "authenticated",
    refetchInterval: POLL_MS,
    staleTime: POLL_MS,
  });

  React.useEffect(() => {
    if (!orders) return;

    const nextIds = new Set(orders.map((o) => o.id));

    if (!primedRef.current) {
      knownIdsRef.current = nextIds;
      primedRef.current = true;
      return;
    }

    const prev = knownIdsRef.current ?? new Set<string>();
    let hasNew = false;
    for (const id of nextIds) {
      if (!prev.has(id)) {
        hasNew = true;
        break;
      }
    }

    knownIdsRef.current = nextIds;

    if (hasNew) {
      playOrderNotificationSound(soundPath);
    }
  }, [orders, soundPath]);

  return null;
}
