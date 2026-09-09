"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { io, type Socket } from "socket.io-client";
import { toast } from "sonner";

import { clientFetch } from "@/lib/api/client-fetch";
import type { OrderDto } from "@/lib/api/types";
import {
  playOrderNotificationSound,
  unlockOrderNotificationAudio,
} from "@/lib/sounds/order-notification";
import { useSoundPreferenceStore } from "@/stores/sound-preference-store";

const POLL_MS = 20_000;

type RealtimeConfig = {
  socketUrl: string | null;
};

type CreatedOrderPayload = OrderDto & {
  orderId?: string;
  user?: { id?: string; phone?: string; name?: string };
};

function orderIdFrom(payload: CreatedOrderPayload | OrderDto): string | null {
  const id = "orderId" in payload ? payload.orderId : undefined;
  const raw = (id || payload.id || "").trim();
  return raw || null;
}

function customerLabel(order: CreatedOrderPayload): string {
  const name = order.user?.name?.trim();
  const phone = order.user?.phone?.trim();
  if (name && phone) return `${name} · ${phone}`;
  return name || phone || "New customer order";
}

/**
 * Plays the admin's preferred notification sound when a customer places
 * an order. Prefers Socket.IO `order.created`; polling is a fallback.
 */
export function NewOrderSoundWatcher() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: session, status } = useSession();
  const soundPath = useSoundPreferenceStore((s) => s.orderNotificationSound);
  const knownIdsRef = React.useRef<Set<string> | null>(null);
  const primedRef = React.useRef(false);
  const soundPathRef = React.useRef(soundPath);
  soundPathRef.current = soundPath;

  React.useEffect(() => {
    const unlock = () => unlockOrderNotificationAudio();
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    try {
      if (!sessionStorage.getItem("neerbottle.soundUnlockHint")) {
        sessionStorage.setItem("neerbottle.soundUnlockHint", "1");
        toast.message("New-order sound alerts are on", {
          description: "Click once anywhere so the browser allows alert audio.",
          duration: 7_000,
        });
      }
    } catch {
      /* ignore */
    }
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  const announceNewOrder = React.useCallback(
    (payload: CreatedOrderPayload) => {
      const id = orderIdFrom(payload);
      if (!id) return;

      const prev = knownIdsRef.current ?? new Set<string>();
      if (prev.has(id)) return;
      prev.add(id);
      knownIdsRef.current = prev;

      void queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-customers"] });

      playOrderNotificationSound(soundPathRef.current);
      toast.success("New order received", {
        description: customerLabel(payload),
        duration: 8_000,
        action: {
          label: "View",
          onClick: () => router.push("/orders"),
        },
      });
    },
    [queryClient, router],
  );

  const { data: realtime } = useQuery({
    queryKey: ["admin-realtime-config"],
    queryFn: async () => {
      const res = await fetch("/api/admin/realtime");
      if (!res.ok) return { socketUrl: null } satisfies RealtimeConfig;
      return res.json() as Promise<RealtimeConfig>;
    },
    enabled: status === "authenticated",
    staleTime: Infinity,
  });

  const { data: orders } = useQuery({
    queryKey: ["admin-orders"],
    queryFn: async () => {
      const res = await clientFetch("/api/bff/admin/orders");
      if (!res.ok) throw new Error("Failed to load orders");
      return res.json() as Promise<OrderDto[]>;
    },
    enabled: status === "authenticated",
    refetchInterval: POLL_MS,
    refetchIntervalInBackground: true,
    staleTime: POLL_MS,
  });

  React.useEffect(() => {
    const token = session?.accessToken;
    const socketUrl = realtime?.socketUrl;
    if (status !== "authenticated" || !token || !socketUrl) return;

    const socket: Socket = io(`${socketUrl.replace(/\/$/, "")}/orders`, {
      auth: { token },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 1_000,
      reconnectionDelayMax: 10_000,
    });

    socket.on("order.created", (payload: CreatedOrderPayload) => {
      announceNewOrder(payload);
    });

    socket.on("order.updated", () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-customers"] });
    });

    socket.on("wallet.updated", () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-customers"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, [
    announceNewOrder,
    queryClient,
    realtime?.socketUrl,
    session?.accessToken,
    status,
  ]);

  React.useEffect(() => {
    if (!orders) return;

    const nextIds = new Set(orders.map((o) => o.id));

    if (!primedRef.current) {
      const prev = knownIdsRef.current ?? new Set<string>();
      knownIdsRef.current = new Set([...prev, ...nextIds]);
      primedRef.current = true;
      return;
    }

    const prev = knownIdsRef.current ?? new Set<string>();
    const newcomers = orders.filter((o) => !prev.has(o.id));
    knownIdsRef.current = new Set([...prev, ...nextIds]);

    for (const order of newcomers) {
      announceNewOrder(order);
    }
  }, [announceNewOrder, orders]);

  return null;
}
