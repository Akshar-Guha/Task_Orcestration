import type { GoalLevel, TimeSlotType } from './types';

// ========================================
// GOAL DISPLAY
// ========================================

export const LEVEL_LABELS: Record<GoalLevel, string> = {
  yearly: 'Yearly Goal',
  quarterly: 'Quarterly Goal',
  monthly: 'Monthly Goal',
  weekly: 'Weekly Goal',
  uncategorized: 'Uncategorized',
};

export const LEVEL_COLORS: Record<GoalLevel, { bg: string; border: string; text: string }> = {
  yearly: { bg: 'bg-amber-500/10', border: 'border-amber-500', text: 'text-amber-400' },
  quarterly: { bg: 'bg-violet-500/10', border: 'border-violet-500', text: 'text-violet-400' },
  monthly: { bg: 'bg-blue-500/10', border: 'border-blue-500', text: 'text-blue-400' },
  weekly: { bg: 'bg-emerald-500/10', border: 'border-emerald-500', text: 'text-emerald-400' },
  uncategorized: { bg: 'bg-slate-500/10', border: 'border-slate-500', text: 'text-slate-400' },
};

// ========================================
// TIME SLOT DISPLAY
// ========================================

export const TIME_SLOT_LABELS: Record<TimeSlotType, string> = {
  morning: '🌅 Morning',
  work: '💼 Work',
  afternoon: '☀️ Afternoon',
  evening: '🌙 Evening',
  leisure: '🎮 Leisure',
};

export const TIME_SLOT_COLORS: Record<TimeSlotType, string> = {
  morning: '#10b981',
  work: '#3b82f6',
  afternoon: '#f59e0b',
  evening: '#8b5cf6',
  leisure: '#ec4899',
};

// ========================================
// TASK / DURATION
// ========================================

export const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120, 180] as const;

// ========================================
// RECURRENCE
// ========================================

export const RECURRENCE_PRESETS = {
  DAILY: 'FREQ=DAILY',
  WEEKDAYS: 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR',
  WEEKLY: 'FREQ=WEEKLY',
  BIWEEKLY: 'FREQ=WEEKLY;INTERVAL=2',
  MONTHLY: 'FREQ=MONTHLY',
  YEARLY: 'FREQ=YEARLY',
} as const;
