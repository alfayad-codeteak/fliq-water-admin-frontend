"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

import {
  DEFAULT_ORDER_NOTIFICATION_SOUND,
  setStoredOrderNotificationSound,
} from "@/lib/sounds/order-notification";

type SoundPreferenceState = {
  orderNotificationSound: string;
  setOrderNotificationSound: (path: string) => void;
};

export const useSoundPreferenceStore = create<SoundPreferenceState>()(
  persist(
    (set) => ({
      orderNotificationSound: DEFAULT_ORDER_NOTIFICATION_SOUND,
      setOrderNotificationSound: (path) => {
        setStoredOrderNotificationSound(path);
        set({ orderNotificationSound: path });
      },
    }),
    {
      name: "neerbottle.sound-preference",
      partialize: (state) => ({
        orderNotificationSound: state.orderNotificationSound,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        setStoredOrderNotificationSound(state.orderNotificationSound);
      },
    },
  ),
);
