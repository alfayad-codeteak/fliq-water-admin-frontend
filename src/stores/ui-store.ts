import { create } from "zustand";

type UiState = {
  commandOpen: boolean;
  setCommandOpen: (open: boolean) => void;
  navigationPending: boolean;
  setNavigationPending: (pending: boolean) => void;
};

export const useUiStore = create<UiState>((set) => ({
  commandOpen: false,
  setCommandOpen: (open) => set({ commandOpen: open }),
  navigationPending: false,
  setNavigationPending: (pending) => set({ navigationPending: pending }),
}));
