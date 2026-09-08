import { create } from "zustand";
import { persist } from "zustand/middleware";

type ShellState = {
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
  toggleCollapsed: () => void;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
};

export const useShellStore = create<ShellState>()(
  persist(
    (set) => ({
      collapsed: false,
      setCollapsed: (collapsed) => set({ collapsed }),
      toggleCollapsed: () => set((s) => ({ collapsed: !s.collapsed })),
      mobileOpen: false,
      setMobileOpen: (mobileOpen) => set({ mobileOpen }),
    }),
    {
      name: "neerbottle-admin-shell",
      partialize: (s) => ({ collapsed: s.collapsed }),
    }
  )
);
