// Core types for Goal Tracker

export type GoalLevel = 'yearly' | 'quarterly' | 'monthly' | 'weekly' | 'uncategorized';
export type GoalStatus = 'not_started' | 'in_progress' | 'completed';

export interface Goal {
  id: string;
  title: string;
  description?: string;
  level: GoalLevel;
  metadata: GoalMetadata;
  
  // Status (3 states)
  status: GoalStatus;
  
  // Life Routine Links removed - Goals are standalone
  
  // Timeline tracking
  createdAt: string;
  startedAt?: string;      // When first task was completed
  completedAt?: string;    // When goal was marked complete
  lastActivityAt?: string; // Last task activity timestamp
  
  // Completion snapshot (stored when goal is completed)
  completionSnapshot?: {
    totalTasks: number;
    completedTasks: number;
    daysToComplete: number;
    activeDays: number;     // Days with activity
    tasks: Array<{ id: string; title: string; completedAt?: string }>;
  };
  
  isArchived: boolean;
}

export type GoalMetadata =
  | { type: 'yearly'; year: number }
  | { type: 'quarterly'; year: number; quarter: 1 | 2 | 3 | 4 }
  | { type: 'monthly'; year: number; month: number }
  | { type: 'weekly'; weekStartDate: string }
  | { type: 'uncategorized' };

export interface Task {
  id: string;
  title: string;
  description?: string;
  
  // Single parent goal (strict one-to-one)
  goalId?: string;
  
  // Repetition tracking
  isRepeating: boolean;
  requiredCount: number;
  completedCount: number;
  
  // Single completion (for non-repeating tasks)
  isCompleted: boolean;
  
  // Life Routine Links removed - Tasks link only to Goals via goalId
  
  // Metadata
  createdAt: string;
  completedAt?: string;
  isArchived: boolean;
}

export interface TaskGoalLink {
  id: string;
  taskId: string;
  goalId: string;
  contributionWeight: number;
  createdAt: string;
}

// ========================================
// TIMELINE EVENT SYSTEM (Core Logging)
// ========================================

export type TimelineEventType = 
  | 'goal_created'
  | 'goal_started'      // Transitioned to in_progress
  | 'goal_completed'
  | 'task_created'
  | 'task_completed'
  | 'task_uncompleted'  // If user unchecks
  | 'task_progress'     // For repeating tasks
  | 'note_added'
  | 'daily_summary';

export interface TimelineEvent {
  id: string;
  timestamp: string;
  eventType: TimelineEventType;
  
  // References
  goalId?: string;
  taskId?: string;
  
  // Context
  details?: string;
  metadata?: Record<string, unknown>;
}

// Legacy ActivityType (keeping for backwards compatibility)
export type ActivityType = 'task_completed' | 'task_created' | 'goal_created' | 'link_created' | 'task_incremented';

export interface ActivityEntry {
  id: string;
  type: ActivityType;
  taskId?: string;
  goalId?: string;
  timestamp: string;
  details?: string;
}

// ========================================
// DAILY SUMMARY (Auto-generated)
// ========================================

export interface TimelineDailySummary {
  id: string;
  date: string;                  // "2026-01-04"
  
  // Stats
  tasksCompleted: number;
  tasksCreated: number;
  goalsProgressed: string[];     // Goal IDs with activity
  goalsCompleted: string[];      // Goals that finished today
  
  // User notes
  highlights?: string[];
  reflection?: string;
  
  createdAt: string;
}

// ========================================
// TIMELINE SYSTEM (Scheduling Foundation)
// ========================================

export type RecurrenceType = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface RecurrencePattern {
  type: RecurrenceType;
  interval: number;           // Every N days/weeks/months/years
  daysOfWeek?: number[];      // 0=Sun, 1=Mon, ..., 6=Sat (for weekly)
  dayOfMonth?: number;        // 1-31 (for monthly)
  endDate?: string;           // When recurrence stops
}

export interface TimeSpec {
  // When is it scheduled?
  scheduledDate?: string;      // "2026-01-01" (ISO date)
  scheduledTime?: string;      // "09:00" (24hr format, IST)
  endTime?: string;            // "10:30" (for duration calculation)
  duration?: number;           // Minutes (alternative to endTime)
  
  // Recurring pattern
  recurrence?: RecurrencePattern;
  
  // Due/Deadline (different from scheduled)
  dueDate?: string;
  dueTime?: string;
  
  // Timezone (default: IST)
  timezone?: string;           // "Asia/Kolkata"
}

// ========================================
// SLEEP/WAKE TRACKING SYSTEM
// ========================================

export type MoodLevel = 1 | 2 | 3 | 4 | 5; // 1=Terrible, 5=Great

export interface SleepWakeLog {
  id: string;
  date: string;                // "2025-12-30" (ISO date)
  
  // Wake-up tracking
  wakeUpTime?: string;         // "06:30" (24hr IST)
  wakeUpConfirmedAt?: string;  // ISO timestamp when confirmed
  wakeUpAdjustedMinutes?: number; // -30 means "woke up 30 min ago"
  wakeUpMood?: MoodLevel;      // How you felt waking up
  
  // Sleep tracking
  sleepTime?: string;          // "23:00" (24hr IST)
  sleepAttempts: string[];     // Array of timestamps for re-enabled sleep button
  
  // Calculated fields
  sleepDurationMinutes?: number;
  
  // Metadata
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SleepStats {
  averageSleepDuration: number;     // Minutes
  averageWakeUpTime: string;        // "06:45"
  averageSleepTime: string;         // "22:30"
  averageMood: number;              // 1-5 scale
  sleepDebtMinutes: number;         // Cumulative deficit (target: 8hrs)
  streakDays: number;               // Consecutive days logged
}

// ========================================
// LIFE ROUTINES SYSTEM (Fixed Foundation)
// ========================================

export type LifeRoutineType = 'health' | 'money' | 'relationship';

export interface LifeRoutine {
  id: string;
  type: LifeRoutineType;
  name: string; // "Health", "Money", "Relationship"
  icon: string; // "💪", "💰", "❤️"
  priority: number; // 1 = highest
  isActive: boolean; // Can deactivate but NOT delete
  color: string; // For UI theming
  createdAt: string;
}

// Legacy SubRoutine system removed - Goals are now the primary entity

export interface DailySummary {
  id: string;
  date: string; // YYYY-MM-DD
  totalTasksCompleted: number;
  totalTasksPlanned: number;
  lifeRoutineBreakdown: {
    health: { completed: number; total: number; percentage: number };
    money: { completed: number; total: number; percentage: number };
  };
  notes?: string;
  timestamp: string;
}

export interface UserSettings {
  dailySummaryTime: string; // "22:00" (10 PM default)
  enableDailySummaryReminder: boolean;
}

// ========================================
// DAILY ROUTINE SYSTEM (Schedule Slots)
// ========================================

export type RoutineType = 'morning' | 'work' | 'evening' | 'leisure';

// A Routine is just a time slot that groups existing Goals
export interface RoutineTemplate {
  id: string;
  name: string;
  type: RoutineType;
  startTime: string; // "06:00"
  endTime: string; // "09:00"
  goalIds: string[]; // References to existing Goals
  isActive: boolean;
  createdAt: string;
}

// Legacy RoutineTask type (for backwards compatibility, will be migrated)
export interface RoutineTask {
  id: string;
  title: string;
  description?: string;
  duration: number; // minutes
  order: number;
  requiresPrevious: boolean;
  linkedGoalIds: string[];
  contributionWeight: number;
}

export interface DailyTaskInstance {
  id: string;
  routineTemplateId: string;
  routineTaskId: string;
  date: string; // YYYY-MM-DD
  scheduledTime: string; // HH:MM
  isUnlocked: boolean;
  isCompleted: boolean;
  completedAt?: string;
}

export interface DailyStat {
  date: string; // YYYY-MM-DD
  wakeUpTime?: string;
  sleepTime?: string;
  sleepDuration?: number; // minutes
}

// ========================================
// PERSONAL DATA COLLECTION (6 Categories)
// ========================================

export interface PhysicalHealth {
  waterIntake: number; // glasses
  mealsLogged: number; // 0-3+
  exerciseDuration: number; // minutes
  exerciseType?: string;
  steps?: number;
  weight?: number;
  energyLevel: 1 | 2 | 3 | 4 | 5;
}

export interface MentalWellness {
  mood: 1 | 2 | 3 | 4 | 5;
  stressLevel: 1 | 2 | 3 | 4 | 5;
  anxietyLevel: 1 | 2 | 3 | 4 | 5;
  meditationMinutes: number;
  journalEntry?: string;
  gratitudeItems: string[];
  mentalChallenges?: string;
}

export interface Productivity {
  deepWorkHours: number;
  distractionsCount: number;
  screenTime: number; // hours
  topDistraction?: string;
  productivityRating: 1 | 2 | 3 | 4 | 5;
}

export interface Social {
  meaningfulConversations: number;
  peopleHelped: number;
  socialTime: number; // hours
  lonelyFeeling: boolean;
  conflictsResolved: number;
  actionsOfKindness: number;
}

export interface Financial {
  moneySpent: number;
  moneyEarned: number;
  savingsContribution: number;
  wasteMoneyOn?: string;
  investedInSelf: number;
}

export interface Environment {
  cleanSpace: boolean;
  timeOutdoors: number; // minutes
  screenFreeTime: number; // minutes
  badHabitsIndulged: string[];
  goodHabitsCompleted: string[];
}

export interface DailyDataPoint {
  id: string;
  date: string; // YYYY-MM-DD
  timestamp: string;
  
  // 6 Categories
  physicalHealth: PhysicalHealth;
  mentalWellness: MentalWellness;
  productivity: Productivity;
  social: Social;
  financial: Financial;
  environment: Environment;
  
  // Auto-calculated from routines
  routineTasksCompleted: number;
  routineTasksTotal: number;
  routineCompletionPercentage: number;
  
  // Meta
  dataCompleteness: number; // % of fields filled
  isFullyLogged: boolean;
}

// Input types
export interface CreateGoalInput {
  title: string;
  description?: string;
  level: GoalLevel;
  metadata: GoalMetadata;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  isRepeating: boolean;
  requiredCount?: number;
  goalId?: string; // Single parent goal
}

// Display helpers
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

export const ROUTINE_LABELS: Record<RoutineType, string> = {
  morning: '🌅 Morning',
  work: '💼 Work',
  evening: '🌙 Evening',
  leisure: '🎮 Leisure',
};

export const LIFE_ROUTINE_CONFIG: Record<LifeRoutineType, { name: string; icon: string; color: string; priority: number }> = {
  health: { name: 'Health', icon: '💪', color: '#10b981', priority: 1 },
  money: { name: 'Money', icon: '💰', color: '#f59e0b', priority: 2 },
  relationship: { name: 'Relationship', icon: '❤️', color: '#ec4899', priority: 3 },
};

