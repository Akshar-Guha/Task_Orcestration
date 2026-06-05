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
  userId: string;     // Added
  name: string;
  type: TimeSlotType;
  startTime: string;  // "06:00" (24hr format)
  endTime: string;    // "09:00"
  color: string;      // Hex color for UI
  goalIds: string[];  // Goals assigned to this slot
  isActive: boolean;
  isNotificationEnabled?: boolean; // New: Toggle notifications for this slot
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
  
  // Priority & Dependencies
  priority: 1 | 2 | 3;          // 1=Critical, 2=Important, 3=Nice-to-have
  dependsOn?: string[];         // Goal IDs this blocks on
  unlocks?: string[];           // Goal IDs this enables
  
  // Time slot assignment (optional)
  timeSlotId?: string;

  // Deadline (NEW)
  deadline?: string;
  
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
    totalMinutesSpent: number;
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
  
  // Daily reset feature
  isDaily: boolean;             // If true, resets on wake-up
  
  // Completion state
  isCompleted: boolean;
  completedAt?: string;
  
  // Metadata
  createdAt: string;
  isArchived: boolean;
}

// TASK-GOAL LINK - Represents relationship between task and goal
export interface TaskGoalLink {
  id: string;
  taskId: string;
  goalId: string;
  contributionWeight: number;  // 0-100, how much this task contributes to goal
  createdAt: string;
}

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
  id?: string;
  date: string;               // "2026-01-10" (unique key)
  productiveMinutes: number;  // Sum of completed task durations
  totalWakingMinutes?: number; // From sleep tracking (for %)
  completions: TaskCompletion[];
  wakeTime?: string;          // ISO timestamp of wake-up
  sleepTime?: string;         // ISO timestamp of sleep
  mood?: MoodLevel;           // Mood at wake-up
  createdAt?: string;
  updatedAt?: string;
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
  userId: string;
  timestamp: string;
  eventType: TimelineEventType;
  goalId?: string;
  taskId?: string;
  relatedId?: string;
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
  
  // Notification Schedule
  dailyMorningTime?: string;    // "07:00"
  enableMorningReminder?: boolean;
  enableTaskNotifications?: boolean;
  enableGoalNotifications?: boolean;
  notificationOffsetMinutes?: number; // New: Pre-alert offset
}

// ========================================
// INPUT TYPES
// ========================================

export interface CreateGoalInput {
  title: string;
  description?: string;
  level: GoalLevel;
  metadata: GoalMetadata;
  timeSlotId?: string;
  deadline?: string; // ISO Date String
  priority?: 1 | 2 | 3;     // Default 2 (Important)
  dependsOn?: string[];     // Goal IDs this blocks on
  unlocks?: string[];       // Goal IDs this enables
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  estimatedMinutes: number;  // REQUIRED now
  goalId?: string;
  isDaily?: boolean;  // Default true - resets on wake-up
}

export interface CreateTimeSlotInput {
  name: string;
  type: TimeSlotType;
  startTime: string;
  endTime: string;
  color?: string;
}
