import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AppState {
  // UI State only
  focusGoalIds: string[];
  
  // Actions
  toggleFocusGoal: (goalId: string) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      focusGoalIds: [],
      
      toggleFocusGoal: (goalId) =>
        set((state) => {
          const isFocused = state.focusGoalIds.includes(goalId);
          if (isFocused) {
            return { focusGoalIds: state.focusGoalIds.filter((id) => id !== goalId) };
          } else {
            return { focusGoalIds: [...state.focusGoalIds, goalId] };
          }
        }),
    }),
    {
      name: 'goal-tracker-ui-state',
      // Only persist UI state
      partialize: (state) => ({ focusGoalIds: state.focusGoalIds }),
    }
  )
);
