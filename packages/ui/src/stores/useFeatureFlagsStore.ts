import { create } from 'zustand';

type FeatureFlagsStore = {
  planModeEnabled: boolean;
  setPlanModeEnabled: (enabled: boolean) => void;
  editableSubagents: boolean;
  setEditableSubagents: (enabled: boolean) => void;
};

export const useFeatureFlagsStore = create<FeatureFlagsStore>((set) => ({
  planModeEnabled: false,
  setPlanModeEnabled: (enabled) => set({ planModeEnabled: enabled }),
  editableSubagents: true,
  setEditableSubagents: (enabled) => set({ editableSubagents: enabled }),
}));
