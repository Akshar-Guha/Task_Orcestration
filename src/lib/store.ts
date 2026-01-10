import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  Goal,
  Task,
  TimeSlot,
  TimelineEvent,
  TimelineEventType,
  TimelineDailySummary,
  ProductivityLog,
  TaskCompletion,
  CreateGoalInput,
  CreateTaskInput,
  CreateTimeSlotInput,
  UserSettings,
  SleepWakeLog,
  SleepStats,
  MoodLevel,
  ProductivityStats,
} from './types';
import { TIME_SLOT_COLORS } from './types';

// ========================================
// APP STATE INTERFACE
// ========================================

interface AppState {
  // Core Data
  goals: Goal[];
  tasks: Task[];
  timeSlots: TimeSlot[];
  
  // Productivity Tracking
  productivityLogs: ProductivityLog[];
  
  // Timeline Events
  timelineEvents: TimelineEvent[];
  timelineDailySummaries: TimelineDailySummary[];
  
  // Sleep/Wake
  sleepWakeLogs: SleepWakeLog[];
  
  // Settings
  userSettings: UserSettings;
  lastInteraction: string | null;
  lastAppOpen: string | null;
  
  // ========== GOAL ACTIONS ==========
  addGoal: (input: CreateGoalInput) => void;
  updateGoal: (id: string, updates: Partial<Goal>) => void;
  startGoal: (id: string) => void;
  completeGoal: (id: string) => void;
  deleteGoal: (id: string) => void;
  archiveGoal: (id: string) => void;
  
  // ========== TASK ACTIONS ==========
  addTask: (input: CreateTaskInput) => string;
  completeTask: (id: string) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  archiveTask: (id: string) => void;
  
  // ========== TIME SLOT ACTIONS ==========
  addTimeSlot: (input: CreateTimeSlotInput) => void;
  updateTimeSlot: (id: string, updates: Partial<TimeSlot>) => void;
  deleteTimeSlot: (id: string) => void;
  addGoalToTimeSlot: (timeSlotId: string, goalId: string) => void;
  removeGoalFromTimeSlot: (timeSlotId: string, goalId: string) => void;
  
  // ========== PRODUCTIVITY ACTIONS ==========
  getTodayProductivity: () => ProductivityStats;
  getGoalTimeSpent: (goalId: string) => number;
  
  // ========== SLEEP/WAKE ACTIONS ==========
  recordWakeUp: (adjustedMinutes?: number, mood?: MoodLevel) => void;
  recordSleep: () => void;
  getTodaySleepLog: () => SleepWakeLog | null;
  getSleepStats: () => SleepStats;
  
  // ========== COMPUTED ==========
  getGoalsForTimeSlot: (timeSlotId: string) => Goal[];
  getTasksForGoal: (goalId: string) => Task[];
  getGoalProgress: (goalId: string) => number;
  getGoalTimelineStats: (goalId: string) => {
    totalDays: number;
    tasksCompleted: number;
    tasksTotal: number;
    minutesSpent: number;
  };
  
  // ========== TIMELINE ==========
  logTimelineEvent: (eventType: TimelineEventType, goalId?: string, taskId?: string, details?: string) => void;
  getTimelineEvents: (limit?: number) => TimelineEvent[];
  getTimelineEventsForGoal: (goalId: string) => TimelineEvent[];
  
  // ========== UTILITY ==========
  trackInteraction: () => void;
  trackAppOpen: () => void;
  updateSettings: (settings: Partial<UserSettings>) => void;
  initializeDefaultTimeSlots: () => void;
  clearAll: () => void;
}

// ========================================
// HELPER FUNCTIONS
// ========================================

const generateId = () => {
  // Use crypto.randomUUID if available (modern browsers)
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback: generate UUID v4 manually
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};
const getToday = () => new Date().toISOString().split('T')[0];
const getNow = () => new Date().toISOString();
const getCurrentTime = () => {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
};

// ========================================
// STORE IMPLEMENTATION
// ========================================

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Initial State
      goals: [],
      tasks: [],
      timeSlots: [],
      productivityLogs: [],
      timelineEvents: [],
      timelineDailySummaries: [],
      sleepWakeLogs: [],
      lastInteraction: null,
      lastAppOpen: null,
      
      userSettings: {
        dailySummaryTime: '22:00',
        enableDailySummaryReminder: true,
        defaultTaskDuration: 30,
        wakingHoursPerDay: 16 * 60, // 16 hours in minutes
      },
      
      // ========== GOAL ACTIONS ==========
      
      addGoal: (input) => {
        const goal: Goal = {
          id: generateId(),
          title: input.title,
          description: input.description,
          level: input.level,
          metadata: input.metadata,
          status: 'not_started',
          timeSlotId: input.timeSlotId,
          createdAt: getNow(),
          isArchived: false,
        };
        
        set((state) => ({ goals: [...state.goals, goal] }));
        
        // If timeSlotId provided, add goal to that slot
        if (input.timeSlotId) {
          get().addGoalToTimeSlot(input.timeSlotId, goal.id);
        }
        
        get().logTimelineEvent('goal_created', goal.id, undefined, `Created goal: ${goal.title}`);
        get().trackInteraction();
      },
      
      updateGoal: (id, updates) => {
        set((state) => ({
          goals: state.goals.map((g) => (g.id === id ? { ...g, ...updates } : g)),
        }));
        get().trackInteraction();
      },
      
      startGoal: (id) => {
        const goal = get().goals.find((g) => g.id === id);
        if (!goal || goal.status !== 'not_started') return;
        
        const now = getNow();
        set((state) => ({
          goals: state.goals.map((g) =>
            g.id === id ? { ...g, status: 'in_progress' as const, startedAt: now, lastActivityAt: now } : g
          ),
        }));
        
        get().logTimelineEvent('goal_started', id, undefined, `Started goal: ${goal.title}`);
        get().trackInteraction();
      },
      
      completeGoal: (id) => {
        const goal = get().goals.find((g) => g.id === id);
        if (!goal) return;
        
        const now = getNow();
        const tasks = get().tasks.filter((t) => t.goalId === id);
        const completedTasks = tasks.filter((t) => t.isCompleted).length;
        const totalMinutesSpent = tasks.reduce((sum, t) => sum + (t.isCompleted ? t.estimatedMinutes : 0), 0);
        
        const createdAt = new Date(goal.createdAt);
        const completedAt = new Date(now);
        const daysToComplete = Math.max(1, Math.ceil((completedAt.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24)));
        
        const completionSnapshot = {
          totalTasks: tasks.length,
          completedTasks,
          daysToComplete,
          activeDays: daysToComplete, // Simplified
          totalMinutesSpent,
          tasks: tasks.map((t) => ({
            id: t.id,
            title: t.title,
            completedAt: t.completedAt,
            duration: t.estimatedMinutes,
          })),
        };
        
        set((state) => ({
          goals: state.goals.map((g) =>
            g.id === id ? { ...g, status: 'completed' as const, completedAt: now, completionSnapshot } : g
          ),
        }));
        
        get().logTimelineEvent('goal_completed', id, undefined, 
          `Completed goal: ${goal.title} (${totalMinutesSpent}min spent)`);
        get().trackInteraction();
      },
      
      deleteGoal: (id) => {
        set((state) => ({
          goals: state.goals.filter((g) => g.id !== id),
          tasks: state.tasks.filter((t) => t.goalId !== id),
          timeSlots: state.timeSlots.map((ts) => ({
            ...ts,
            goalIds: ts.goalIds.filter((gid) => gid !== id),
          })),
        }));
        get().trackInteraction();
      },
      
      archiveGoal: (id) => {
        get().updateGoal(id, { isArchived: true });
      },
      
      // ========== TASK ACTIONS ==========
      
      addTask: (input) => {
        const task: Task = {
          id: generateId(),
          title: input.title,
          description: input.description,
          goalId: input.goalId,
          estimatedMinutes: input.estimatedMinutes || get().userSettings.defaultTaskDuration,
          isCompleted: false,
          createdAt: getNow(),
          isArchived: false,
        };
        
        set((state) => ({ tasks: [...state.tasks, task] }));
        get().logTimelineEvent('task_created', task.goalId, task.id, `Created task: ${task.title} [${task.estimatedMinutes}m]`);
        get().trackInteraction();
        return task.id;
      },
      
      completeTask: (id) => {
        const task = get().tasks.find((t) => t.id === id);
        if (!task) return;
        
        const now = getNow();
        const today = getToday();
        const isCompleting = !task.isCompleted;
        
        // Update task completion state
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === id ? { ...t, isCompleted: !t.isCompleted, completedAt: isCompleting ? now : undefined } : t
          ),
        }));
        
        // If completing (not uncompleting), log productivity
        if (isCompleting) {
          const completion: TaskCompletion = {
            id: generateId(),
            taskId: task.id,
            goalId: task.goalId,
            date: today,
            durationMinutes: task.estimatedMinutes,
            completedAt: now,
          };
          
          // Update or create today's productivity log
          set((state) => {
            const existingLog = state.productivityLogs.find((l) => l.date === today);
            if (existingLog) {
              return {
                productivityLogs: state.productivityLogs.map((l) =>
                  l.date === today
                    ? {
                        ...l,
                        productiveMinutes: l.productiveMinutes + task.estimatedMinutes,
                        completions: [...l.completions, completion],
                        updatedAt: now,
                      }
                    : l
                ),
              };
            } else {
              const newLog: ProductivityLog = {
                id: generateId(),
                date: today,
                productiveMinutes: task.estimatedMinutes,
                completions: [completion],
                createdAt: now,
                updatedAt: now,
              };
              return { productivityLogs: [...state.productivityLogs, newLog] };
            }
          });
          
          // Auto-start parent goal if not started
          if (task.goalId) {
            const goal = get().goals.find((g) => g.id === task.goalId);
            if (goal && goal.status === 'not_started') {
              get().startGoal(task.goalId);
            } else if (goal) {
              get().updateGoal(task.goalId, { lastActivityAt: now });
            }
          }
          
          get().logTimelineEvent('task_completed', task.goalId, id, `Completed: ${task.title} (+${task.estimatedMinutes}m)`);
        } else {
          // Uncompleting - subtract from productivity
          set((state) => {
            const existingLog = state.productivityLogs.find((l) => l.date === today);
            if (existingLog) {
              return {
                productivityLogs: state.productivityLogs.map((l) =>
                  l.date === today
                    ? {
                        ...l,
                        productiveMinutes: Math.max(0, l.productiveMinutes - task.estimatedMinutes),
                        completions: l.completions.filter((c) => c.taskId !== task.id),
                        updatedAt: now,
                      }
                    : l
                ),
              };
            }
            return {};
          });
          
          get().logTimelineEvent('task_uncompleted', task.goalId, id, `Uncompleted: ${task.title}`);
        }
        
        get().trackInteraction();
      },
      
      updateTask: (id, updates) => {
        set((state) => ({
          tasks: state.tasks.map((t) => (t.id === id ? { ...t, ...updates } : t)),
        }));
        get().trackInteraction();
      },
      
      deleteTask: (id) => {
        set((state) => ({ tasks: state.tasks.filter((t) => t.id !== id) }));
        get().trackInteraction();
      },
      
      archiveTask: (id) => {
        get().updateTask(id, { isArchived: true });
      },
      
      // ========== TIME SLOT ACTIONS ==========
      
      addTimeSlot: (input) => {
        const timeSlot: TimeSlot = {
          id: generateId(),
          name: input.name,
          type: input.type,
          startTime: input.startTime,
          endTime: input.endTime,
          color: input.color || TIME_SLOT_COLORS[input.type],
          goalIds: [],
          isActive: true,
          createdAt: getNow(),
        };
        set((state) => ({ timeSlots: [...state.timeSlots, timeSlot] }));
        get().trackInteraction();
      },
      
      updateTimeSlot: (id, updates) => {
        set((state) => ({
          timeSlots: state.timeSlots.map((ts) => (ts.id === id ? { ...ts, ...updates } : ts)),
        }));
        get().trackInteraction();
      },
      
      deleteTimeSlot: (id) => {
        set((state) => ({ timeSlots: state.timeSlots.filter((ts) => ts.id !== id) }));
        get().trackInteraction();
      },
      
      addGoalToTimeSlot: (timeSlotId, goalId) => {
        set((state) => ({
          timeSlots: state.timeSlots.map((ts) =>
            ts.id === timeSlotId && !ts.goalIds.includes(goalId)
              ? { ...ts, goalIds: [...ts.goalIds, goalId] }
              : ts
          ),
          goals: state.goals.map((g) =>
            g.id === goalId ? { ...g, timeSlotId } : g
          ),
        }));
        get().trackInteraction();
      },
      
      removeGoalFromTimeSlot: (timeSlotId, goalId) => {
        set((state) => ({
          timeSlots: state.timeSlots.map((ts) =>
            ts.id === timeSlotId ? { ...ts, goalIds: ts.goalIds.filter((id) => id !== goalId) } : ts
          ),
          goals: state.goals.map((g) =>
            g.id === goalId && g.timeSlotId === timeSlotId ? { ...g, timeSlotId: undefined } : g
          ),
        }));
        get().trackInteraction();
      },
      
      // ========== PRODUCTIVITY ACTIONS ==========
      
      getTodayProductivity: () => {
        const today = getToday();
        const todayLog = get().productivityLogs.find((l) => l.date === today);
        const productiveMinutes = todayLog?.productiveMinutes || 0;
        const totalWaking = get().userSettings.wakingHoursPerDay;
        
        // Week calculation
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        const weekLogs = get().productivityLogs.filter((l) => new Date(l.date) >= weekAgo);
        const weekMinutes = weekLogs.reduce((sum, l) => sum + l.productiveMinutes, 0);
        
        // Top goals
        const goalMinutes: Record<string, number> = {};
        (todayLog?.completions || []).forEach((c) => {
          if (c.goalId) {
            goalMinutes[c.goalId] = (goalMinutes[c.goalId] || 0) + c.durationMinutes;
          }
        });
        
        const topGoals = Object.entries(goalMinutes)
          .map(([goalId, minutes]) => ({ goalId, minutes }))
          .sort((a, b) => b.minutes - a.minutes)
          .slice(0, 5);
        
        return {
          todayMinutes: productiveMinutes,
          todayPercentage: Math.round((productiveMinutes / totalWaking) * 100),
          weekMinutes,
          weeklyAverage: Math.round(weekMinutes / 7),
          topGoals,
        };
      },
      
      getGoalTimeSpent: (goalId) => {
        const allCompletions = get().productivityLogs.flatMap((l) => l.completions);
        return allCompletions
          .filter((c) => c.goalId === goalId)
          .reduce((sum, c) => sum + c.durationMinutes, 0);
      },
      
      // ========== SLEEP/WAKE ACTIONS ==========
      
      recordWakeUp: (adjustedMinutes = 0, mood) => {
        const today = getToday();
        const now = new Date();
        now.setMinutes(now.getMinutes() - adjustedMinutes);
        const wakeUpTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        
        set((state) => {
          const existing = state.sleepWakeLogs.find((l) => l.date === today);
          if (existing) {
            return {
              sleepWakeLogs: state.sleepWakeLogs.map((l) =>
                l.date === today
                  ? { ...l, wakeUpTime, wakeUpConfirmedAt: getNow(), wakeUpMood: mood, updatedAt: getNow() }
                  : l
              ),
            };
          }
          const newLog: SleepWakeLog = {
            id: generateId(),
            date: today,
            wakeUpTime,
            wakeUpConfirmedAt: getNow(),
            wakeUpMood: mood,
            sleepAttempts: [],
            createdAt: getNow(),
            updatedAt: getNow(),
          };
          return { sleepWakeLogs: [...state.sleepWakeLogs, newLog] };
        });
        get().trackInteraction();
      },
      
      recordSleep: () => {
        const today = getToday();
        const sleepTime = getCurrentTime();
        
        set((state) => {
          const existing = state.sleepWakeLogs.find((l) => l.date === today);
          if (existing) {
            return {
              sleepWakeLogs: state.sleepWakeLogs.map((l) =>
                l.date === today
                  ? { ...l, sleepTime, sleepAttempts: [...l.sleepAttempts, getNow()], updatedAt: getNow() }
                  : l
              ),
            };
          }
          const newLog: SleepWakeLog = {
            id: generateId(),
            date: today,
            sleepTime,
            sleepAttempts: [getNow()],
            createdAt: getNow(),
            updatedAt: getNow(),
          };
          return { sleepWakeLogs: [...state.sleepWakeLogs, newLog] };
        });
        get().trackInteraction();
      },
      
      getTodaySleepLog: () => {
        const today = getToday();
        return get().sleepWakeLogs.find((l) => l.date === today) || null;
      },
      
      getSleepStats: () => {
        const logs = get().sleepWakeLogs.slice(-30); // Last 30 days
        if (logs.length === 0) {
          return {
            averageSleepDuration: 0,
            averageWakeUpTime: '07:00',
            averageSleepTime: '23:00',
            averageMood: 3,
            sleepDebtMinutes: 0,
            streakDays: 0,
          };
        }
        
        const durationsWithData = logs.filter((l) => l.sleepDurationMinutes);
        const avgDuration = durationsWithData.length > 0
          ? durationsWithData.reduce((sum, l) => sum + (l.sleepDurationMinutes || 0), 0) / durationsWithData.length
          : 0;
        
        const moodsWithData = logs.filter((l) => l.wakeUpMood);
        const avgMood = moodsWithData.length > 0
          ? moodsWithData.reduce((sum, l) => sum + (l.wakeUpMood || 3), 0) / moodsWithData.length
          : 3;
        
        return {
          averageSleepDuration: Math.round(avgDuration),
          averageWakeUpTime: '07:00', // Simplified
          averageSleepTime: '23:00',
          averageMood: Math.round(avgMood * 10) / 10,
          sleepDebtMinutes: Math.max(0, (8 * 60 - avgDuration) * logs.length),
          streakDays: logs.length,
        };
      },
      
      // ========== COMPUTED ==========
      
      getGoalsForTimeSlot: (timeSlotId) => {
        const slot = get().timeSlots.find((ts) => ts.id === timeSlotId);
        if (!slot) return [];
        return get().goals.filter((g) => slot.goalIds.includes(g.id) && !g.isArchived);
      },
      
      getTasksForGoal: (goalId) => {
        return get().tasks.filter((t) => t.goalId === goalId && !t.isArchived);
      },
      
      getGoalProgress: (goalId) => {
        const tasks = get().getTasksForGoal(goalId);
        if (tasks.length === 0) return 0;
        
        const totalMinutes = tasks.reduce((sum, t) => sum + t.estimatedMinutes, 0);
        const completedMinutes = tasks.filter((t) => t.isCompleted).reduce((sum, t) => sum + t.estimatedMinutes, 0);
        
        return totalMinutes > 0 ? Math.round((completedMinutes / totalMinutes) * 100) : 0;
      },
      
      getGoalTimelineStats: (goalId) => {
        const goal = get().goals.find((g) => g.id === goalId);
        if (!goal) return { totalDays: 0, tasksCompleted: 0, tasksTotal: 0, minutesSpent: 0 };
        
        const tasks = get().getTasksForGoal(goalId);
        const completedTasks = tasks.filter((t) => t.isCompleted);
        const minutesSpent = completedTasks.reduce((sum, t) => sum + t.estimatedMinutes, 0);
        
        const createdAt = new Date(goal.createdAt);
        const now = new Date();
        const totalDays = Math.max(1, Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24)));
        
        return {
          totalDays,
          tasksCompleted: completedTasks.length,
          tasksTotal: tasks.length,
          minutesSpent,
        };
      },
      
      // ========== TIMELINE ==========
      
      logTimelineEvent: (eventType, goalId, taskId, details) => {
        const event: TimelineEvent = {
          id: generateId(),
          timestamp: getNow(),
          eventType,
          goalId,
          taskId,
          details,
        };
        set((state) => ({
          timelineEvents: [event, ...state.timelineEvents].slice(0, 500),
        }));
      },
      
      getTimelineEvents: (limit = 50) => {
        return get().timelineEvents.slice(0, limit);
      },
      
      getTimelineEventsForGoal: (goalId) => {
        return get().timelineEvents.filter((e) => e.goalId === goalId);
      },
      
      // ========== UTILITY ==========
      
      trackInteraction: () => {
        set({ lastInteraction: getNow() });
      },
      
      trackAppOpen: () => {
        set({ lastAppOpen: getNow() });
      },
      
      updateSettings: (settings) => {
        set((state) => ({
          userSettings: { ...state.userSettings, ...settings },
        }));
        get().trackInteraction();
      },
      
      initializeDefaultTimeSlots: () => {
        const existing = get().timeSlots;
        if (existing.length > 0) return;
        
        const defaultSlots: CreateTimeSlotInput[] = [
          { name: 'Morning Routine', type: 'morning', startTime: '06:00', endTime: '09:00' },
          { name: 'Deep Work', type: 'work', startTime: '09:00', endTime: '12:00' },
          { name: 'Afternoon', type: 'afternoon', startTime: '14:00', endTime: '17:00' },
          { name: 'Evening', type: 'evening', startTime: '17:00', endTime: '21:00' },
        ];
        
        defaultSlots.forEach((slot) => get().addTimeSlot(slot));
      },
      
      clearAll: () => {
        set({
          goals: [],
          tasks: [],
          timeSlots: [],
          productivityLogs: [],
          timelineEvents: [],
          timelineDailySummaries: [],
          sleepWakeLogs: [],
        });
      },
    }),
    {
      name: 'goal-tracker-storage',
      version: 2, // Increment to trigger migration if needed
    }
  )
);
