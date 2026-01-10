// Core types for Goal Tracker - Aligned with MTO Architecture
// Uses graph model (nodes/edges) with type-specific properties

// ========================================
// CORE ENTITIES
// ========================================

export type GoalLevel = 'yearly' | 'quarterly' | 'monthly' | 'weekly' | 'uncategorized';
export type GoalStatus = 'not_started' | 'in_progress' | 'completed';
export type TimeSlotType = 'morning' | 'work' | 'afternoon' | 'evening' | 'leisure';

// TIME SLOT - Groups goals into daily schedule blocks
export interface TimeSlot {
  id: string;
  name: string;
  type: TimeSlotType;
  startTime: string;  // "06:00" (24hr format)
  endTime: string;    // "09:00"
  color: string;      // Hex color for UI
  goalIds: string[];  // Goals assigned to this slot
  isActive: boolean;
  createdAt: string;
}

// GOAL - Container for tasks with status tracking
export interface Goal {
  id: string;
  title: string;
  description?: string;
  level: GoalLevel;
  metadata: GoalMetadata;
  status: GoalStatus;
  
  // Time slot assignment (optional)
  timeSlotId?: string;
  
  // Timeline tracking
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  lastActivityAt?: string;
  
  // Completion snapshot
  completionSnapshot?: {
    totalTasks: number;
    completedTasks: number;
    daysToComplete: number;
    activeDays: number;
    totalMinutesSpent: number;  // NEW: Total time invested
    tasks: Array<{ id: string; title: string; completedAt?: string; duration?: number }>;
  };
  
  isArchived: boolean;
}

export type GoalMetadata =
  | { type: 'yearly'; year: number }
  | { type: 'quarterly'; year: number; quarter: 1 | 2 | 3 | 4 }
  | { type: 'monthly'; year: number; month: number }
  | { type: 'weekly'; weekStartDate: string }
  | { type: 'uncategorized' };

// TASK - Actionable item with duration tracking
export interface Task {
  id: string;
  title: string;
  description?: string;
  goalId?: string;
  
  // Duration tracking (NEW - replaces isRepeating)
  estimatedMinutes: number;     // How long task should take
  actualMinutes?: number;       // How long it actually took (optional)
  
  // Completion state
  isCompleted: boolean;
  completedAt?: string;
  
  // Metadata
  createdAt: string;
  isArchived: boolean;
}

// ========================================
// PRODUCTIVITY TRACKING (NEW)
// ========================================

// Individual task completion record
export interface TaskCompletion {
  id: string;
  taskId: string;
  goalId?: string;
  date: string;           // "2026-01-10"
  durationMinutes: number;
  completedAt: string;
}

// Daily productivity summary
export interface ProductivityLog {
  id: string;
  date: string;               // "2026-01-10" (unique key)
  productiveMinutes: number;  // Sum of completed task durations
  totalWakingMinutes?: number; // From sleep tracking (for %)
  completions: TaskCompletion[];
  createdAt: string;
  updatedAt: string;
}

// Productivity stats helper
export interface ProductivityStats {
  todayMinutes: number;
  todayPercentage: number;
  weekMinutes: number;
  weeklyAverage: number;
  topGoals: Array<{ goalId: string; minutes: number }>;
}

// ========================================
// TIMELINE EVENT SYSTEM
// ========================================

export type TimelineEventType = 
  | 'goal_created'
  | 'goal_started'
  | 'goal_completed'
  | 'task_created'
  | 'task_completed'
  | 'task_uncompleted'
  | 'productivity_logged';  // NEW

export interface TimelineEvent {
  id: string;
  timestamp: string;
  eventType: TimelineEventType;
  goalId?: string;
  taskId?: string;
  details?: string;
  metadata?: Record<string, unknown>;
}

// ========================================
// SLEEP/WAKE TRACKING
// ========================================

export type MoodLevel = 1 | 2 | 3 | 4 | 5;

export interface SleepWakeLog {
  id: string;
  date: string;
  wakeUpTime?: string;
  wakeUpConfirmedAt?: string;
  wakeUpMood?: MoodLevel;
  sleepTime?: string;
  sleepAttempts: string[];
  sleepDurationMinutes?: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SleepStats {
  averageSleepDuration: number;
  averageWakeUpTime: string;
  averageSleepTime: string;
  averageMood: number;
  sleepDebtMinutes: number;
  streakDays: number;
}

// ========================================
// DAILY SUMMARY
// ========================================

export interface TimelineDailySummary {
  id: string;
  date: string;
  tasksCompleted: number;
  tasksCreated: number;
  productiveMinutes: number;  // NEW: From productivity log
  goalsProgressed: string[];
  goalsCompleted: string[];
  highlights?: string[];
  reflection?: string;
  createdAt: string;
}

// ========================================
// SCHEDULING (TimeSpec)
// ========================================

export type RecurrenceType = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface RecurrencePattern {
  type: RecurrenceType;
  interval: number;
  daysOfWeek?: number[];
  dayOfMonth?: number;
  endDate?: string;
}

export interface TimeSpec {
  scheduledDate?: string;
  scheduledTime?: string;
  endTime?: string;
  duration?: number;
  recurrence?: RecurrencePattern;
  dueDate?: string;
  dueTime?: string;
  timezone?: string;
}

// ========================================
// USER SETTINGS
// ========================================

export interface UserSettings {
  dailySummaryTime: string;
  enableDailySummaryReminder: boolean;
  defaultTaskDuration: number;  // NEW: Default duration for new tasks
  wakingHoursPerDay: number;    // NEW: For productivity % calculation
}

// ========================================
// INPUT TYPES
// ========================================

export interface CreateGoalInput {
  title: string;
  description?: string;
  level: GoalLevel;
  metadata: GoalMetadata;
  timeSlotId?: string;  // NEW: Optional time slot assignment
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  estimatedMinutes: number;  // REQUIRED now
  goalId?: string;
}

export interface CreateTimeSlotInput {
  name: string;
  type: TimeSlotType;
  startTime: string;
  endTime: string;
  color?: string;
}

// ========================================
// DISPLAY HELPERS
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

export const TIME_SLOT_LABELS: Record<TimeSlotType, string> = {
  morning: '🌅 Morning',
  work: '💼 Work',
  afternoon: '☀️ Afternoon',
  evening: '🌙 Evening',
  leisure: '🎮 Leisure',
};

export const TIME_SLOT_COLORS: Record<TimeSlotType, string> = {
  morning: '#10b981',   // Emerald
  work: '#3b82f6',      // Blue
  afternoon: '#f59e0b', // Amber
  evening: '#8b5cf6',   // Violet
  leisure: '#ec4899',   // Pink
};

// Duration quick-select options (in minutes)
export const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120, 180];

// Format duration for display
export const formatDuration = (minutes: number): string => {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
};
