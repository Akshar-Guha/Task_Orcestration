import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  Goal,
  Task,
  TaskGoalLink,
  ActivityEntry,
  TimelineEvent,
  TimelineEventType,
  TimelineDailySummary,
  CreateGoalInput,
  CreateTaskInput,
  RoutineTemplate,
  DailyTaskInstance,
  DailyStat,
  DailyDataPoint,
  PhysicalHealth,
  MentalWellness,
  Productivity,
  Social,
  Financial,
  Environment,
  LifeRoutine,
  DailySummary,
  UserSettings,
  LifeRoutineType,
  SleepWakeLog,
  SleepStats,
  MoodLevel,
} from './types';
import { LIFE_ROUTINE_CONFIG } from './types';

interface AppState {
  // Existing Data
  goals: Goal[];
  tasks: Task[];
  nodePositions: Record<string, { x: number; y: number }>;
  links: TaskGoalLink[];
  activities: ActivityEntry[];
  
  // Timeline Events (Core tracking)
  timelineEvents: TimelineEvent[];
  timelineDailySummaries: TimelineDailySummary[];
  
  // Routine System
  routineTemplates: RoutineTemplate[];
  dailyTaskInstances: DailyTaskInstance[];
  dailyStats: DailyStat[];
  dailyDataPoints: DailyDataPoint[];
  lastAppOpen: string | null;
  lastInteraction: string | null;
  
  // NEW: Life Routines System
  lifeRoutines: LifeRoutine[];
  // subRoutines removed - Goals are the primary entity now
  dailySummaries: DailySummary[];
  userSettings: UserSettings;
  
  // NEW: Sleep/Wake Tracking
  sleepWakeLogs: SleepWakeLog[];
  
  // Goal Actions
  addGoal: (input: CreateGoalInput) => void;
  updateGoal: (id: string, updates: Partial<Goal>) => void;
  startGoal: (id: string) => void;
  completeGoal: (id: string) => void;
  deleteGoal: (id: string) => void;
  archiveGoal: (id: string) => void;
  
  // Task Actions
  addTask: (input: CreateTaskInput) => string;
  completeTask: (id: string) => void;
  incrementTask: (id: string) => void;
  decrementTask: (id: string) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  archiveTask: (id: string) => void;
  
  // Link Actions
  linkTaskToGoal: (taskId: string, goalId: string, weight: number) => void;
  unlinkTask: (linkId: string) => void;
  updateLinkWeight: (linkId: string, weight: number) => void;
  
  // Routine Actions
  createRoutineTemplate: (template: Omit<RoutineTemplate, 'id' | 'createdAt'>) => void;
  updateRoutineTemplate: (id: string, updates: Partial<RoutineTemplate>) => void;
  deleteRoutineTemplate: (id: string) => void;
  resetDailyTasks: () => void;
  completeDailyTask: (id: string) => void;
  
  // NEW: Life Routine Actions
  initializeLifeRoutines: () => void;
  // SubRoutine actions removed
  saveDailySummary: (summary: Omit<DailySummary, 'id' | 'timestamp'>) => void;
  getDailySummary: (date: string) => DailySummary | null;
  updateSettings: (settings: Partial<UserSettings>) => void;
  
  // Tracking Actions
  trackAppOpen: () => void;
  trackInteraction: () => void;
  
  // Daily Check-In
  saveDailyCheckIn: (data: Partial<DailyDataPoint>) => void;
  getTodayCheckIn: () => DailyDataPoint | null;
  
  // NEW: Sleep/Wake Tracking Actions
  recordWakeUp: (adjustedMinutes?: number, mood?: MoodLevel) => void;
  recordSleep: () => void;
  getTodaySleepLog: () => SleepWakeLog | null;
  getSleepLogs: (days?: number) => SleepWakeLog[];
  getSleepStats: () => SleepStats;
  
  // Computed
  getGoalProgress: (goalId: string) => number;
  getTasksForGoal: (goalId: string) => Task[];
  getGoalsForTask: (taskId: string) => Goal[];
  getLinksForTask: (taskId: string) => TaskGoalLink[];
  getLinksForGoal: (goalId: string) => TaskGoalLink[];
  getTodayRoutineTasks: () => DailyTaskInstance[];
  getRoutineProgress: (routineType: string) => { completed: number; total: number };
  
  // Goal Timeline Stats
  getGoalTimelineStats: (goalId: string) => {
    daysToComplete: number | null;
    totalDays: number;
    tasksCompleted: number;
    tasksTotal: number;
  };
  
  // NEW: Life Routine Computed
  getLifeRoutineProgress: (lifeRoutineType: LifeRoutineType) => { completed: number; total: number; percentage: number };
  
  // Activity
  logActivity: (entry: Omit<ActivityEntry, 'id' | 'timestamp'>) => void;
  getRecentActivity: (limit?: number) => ActivityEntry[];
  
  // Timeline Events
  logTimelineEvent: (eventType: TimelineEventType, goalId?: string, taskId?: string, details?: string) => void;
  getTimelineEvents: (limit?: number) => TimelineEvent[];
  getTimelineEventsForGoal: (goalId: string) => TimelineEvent[];
  
  // Node positions
  saveNodePosition: (nodeId: string, position: { x: number; y: number }) => void;
  clearNodePositions: () => void;
  
  // Utility
  loadSampleData: () => void;
  loadDefaultRoutines: () => void;
  clearAll: () => void;
}

const generateId = () => self.crypto.randomUUID();

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Initial State
      goals: [],
      tasks: [],
      links: [],
      activities: [],
      routineTemplates: [],
      dailyTaskInstances: [],
      dailyStats: [],
      dailyDataPoints: [],
      lifeRoutines: [],
      subRoutines: [],
      dailySummaries: [],
      sleepWakeLogs: [],
      timelineEvents: [],
      timelineDailySummaries: [],
      lastInteraction: null,
      nodePositions: {},
      lastAppOpen: '',
      
      userSettings: {
        dailySummaryTime: '22:00',
        enableDailySummaryReminder: true,
      },
      
      addGoal: (input) => {
        const goal: Goal = {
          id: generateId(),
          ...input,
          status: 'not_started',
          createdAt: new Date().toISOString(),
          isArchived: false,
        };
        set((state) => ({ goals: [...state.goals, goal] }));
        get().logActivity({ type: 'goal_created', goalId: goal.id });
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
        const now = new Date().toISOString();
        set((state) => ({
          goals: state.goals.map((g) => 
            g.id === id && g.status === 'not_started'
              ? { ...g, status: 'in_progress' as const, startedAt: now, lastActivityAt: now }
              : g
          ),
        }));
        if (goal) {
          get().logTimelineEvent('goal_started', id, undefined, `Started goal: ${goal.title}`);
        }
        get().trackInteraction();
      },
      
      completeGoal: (id) => {
        const goal = get().goals.find((g) => g.id === id);
        if (!goal) return;
        
        const now = new Date().toISOString();
        const tasks = get().tasks.filter((t) => t.goalId === id);
        const completedTasks = tasks.filter((t) => t.isCompleted).length;
        
        // Calculate days to complete
        const createdAt = new Date(goal.createdAt);
        const completedAt = new Date(now);
        const daysToComplete = Math.ceil((completedAt.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
        
        // Calculate active days from timeline events
        const goalEvents = get().timelineEvents.filter((e) => e.goalId === id);
        const uniqueDays = new Set(goalEvents.map((e) => e.timestamp.split('T')[0]));
        const activeDays = uniqueDays.size;
        
        // Create snapshot
        const completionSnapshot = {
          totalTasks: tasks.length,
          completedTasks,
          daysToComplete,
          activeDays,
          tasks: tasks.map((t) => ({ 
            id: t.id, 
            title: t.title, 
            completedAt: t.completedAt 
          })),
        };
        
        set((state) => ({
          goals: state.goals.map((g) => 
            g.id === id
              ? { ...g, status: 'completed' as const, completedAt: now, completionSnapshot }
              : g
          ),
        }));
        
        get().logTimelineEvent('goal_completed', id, undefined, `Completed goal: ${goal.title} (${completedTasks}/${tasks.length} tasks in ${daysToComplete} days)`);
        get().trackInteraction();
      },
      
      deleteGoal: (id) => {
        set((state) => ({
          goals: state.goals.filter((g) => g.id !== id),
          links: state.links.filter((l) => l.goalId !== id),
        }));
        get().trackInteraction();
      },
      
      archiveGoal: (id) => {
        get().updateGoal(id, { isArchived: true });
      },
      
      // TASK ACTIONS (Updated)
      addTask: (input) => {
        const task: Task = {
          id: generateId(),
          title: input.title,
          description: input.description,
          goalId: input.goalId, // Single parent goal
          isRepeating: input.isRepeating,
          requiredCount: input.isRepeating && input.requiredCount ? input.requiredCount : 1,
          completedCount: 0,
          isCompleted: false,
          createdAt: new Date().toISOString(),
          isArchived: false,
        };
        set((state) => ({ tasks: [...state.tasks, task] }));
        get().logActivity({ type: 'task_created', taskId: task.id });
        get().logTimelineEvent('task_created', task.goalId, task.id, `Created task: ${task.title}`);
        get().trackInteraction();
        return task.id;
      },
      
      completeTask: (id) => {
        const task = get().tasks.find((t) => t.id === id);
        if (!task || task.isRepeating) return;
        
        const now = new Date().toISOString();
        const isCompleting = !task.isCompleted;
        
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === id ? { ...t, isCompleted: !t.isCompleted, completedAt: isCompleting ? now : undefined } : t
          ),
        }));
        
        // Update parent goal if task has one
        if (isCompleting && task.goalId) {
          const goal = get().goals.find((g) => g.id === task.goalId);
          if (goal) {
            // Auto-start goal if not started
            if (goal.status === 'not_started') {
              get().startGoal(task.goalId);
            } else {
              // Just update lastActivityAt
              get().updateGoal(task.goalId, { lastActivityAt: now });
            }
          }
        }
        
        if (isCompleting) {
          get().logActivity({ type: 'task_completed', taskId: id });
          get().logTimelineEvent('task_completed', task.goalId, id, `Completed: ${task.title}`);
        } else {
          get().logTimelineEvent('task_uncompleted', task.goalId, id, `Uncompleted: ${task.title}`);
        }
        get().trackInteraction();
      },
      
      incrementTask: (id) => {
        const task = get().tasks.find((t) => t.id === id);
        if (!task || !task.isRepeating) return;
        
        const newCount = Math.min(task.completedCount + 1, task.requiredCount);
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === id ? { ...t, completedCount: newCount, completedAt: new Date().toISOString() } : t
          ),
        }));
        
        get().logActivity({
          type: 'task_incremented',
          taskId: id,
          details: `${newCount}/${task.requiredCount}`,
        });
        
        get().logTimelineEvent('task_progress', task.goalId, id, `Progress: ${newCount}/${task.requiredCount} - ${task.title}`);
        
        if (newCount === task.requiredCount) {
          get().logActivity({ type: 'task_completed', taskId: id, details: 'Fully completed!' });
          get().logTimelineEvent('task_completed', task.goalId, id, `Completed: ${task.title} (${task.requiredCount}/${task.requiredCount})`);
        }
        get().trackInteraction();
      },
      
      decrementTask: (id) => {
        const task = get().tasks.find((t) => t.id === id);
        if (!task || !task.isRepeating) return;
        
        const newCount = Math.max(task.completedCount - 1, 0);
        set((state) => ({
          tasks: state.tasks.map((t) => (t.id === id ? { ...t, completedCount: newCount } : t)),
        }));
        get().trackInteraction();
      },
      
      deleteTask: (id) => {
        set((state) => ({
          tasks: state.tasks.filter((t) => t.id !== id),
          links: state.links.filter((l) => l.taskId !== id),
        }));
        get().trackInteraction();
      },
      
      archiveTask: (id) => {
        set((state) => ({
          tasks: state.tasks.map((t) => (t.id === id ? { ...t, isArchived: true } : t)),
        }));
        get().trackInteraction();
      },
      
      updateTask: (id, updates) => {
        set((state) => ({
          tasks: state.tasks.map((t) => (t.id === id ? { ...t, ...updates } : t)),
        }));
        get().trackInteraction();
      },
      
      // LINK ACTIONS
      linkTaskToGoal: (taskId, goalId, weight) => {
        const link: TaskGoalLink = {
          id: generateId(),
          taskId,
          goalId,
          contributionWeight: Math.min(100, Math.max(1, weight)),
          createdAt: new Date().toISOString(),
        };
        set((state) => ({ links: [...state.links, link] }));
        get().logActivity({ type: 'link_created', taskId, goalId, details: `${weight}%` });
        get().trackInteraction();
      },
      
      unlinkTask: (linkId) => {
        set((state) => ({ links: state.links.filter((l) => l.id !== linkId) }));
        get().trackInteraction();
      },
      
      updateLinkWeight: (linkId, weight) => {
        set((state) => ({
          links: state.links.map((l) =>
            l.id === linkId ? { ...l, contributionWeight: Math.min(100, Math.max(1, weight)) } : l
          ),
        }));
        get().trackInteraction();
      },
      
      // ROUTINE ACTIONS
      createRoutineTemplate: (template) => {
        const newTemplate: RoutineTemplate = {
          ...template,
          id: generateId(),
          createdAt: new Date().toISOString(),
        };
        set((state) => ({ routineTemplates: [...state.routineTemplates, newTemplate] }));
        get().trackInteraction();
      },
      
      updateRoutineTemplate: (id, updates) => {
        set((state) => ({
          routineTemplates: state.routineTemplates.map((r) => (r.id === id ? { ...r, ...updates } : r)),
        }));
        get().trackInteraction();
      },
      
      deleteRoutineTemplate: (id) => {
        set((state) => ({ routineTemplates: state.routineTemplates.filter((r) => r.id !== id) }));
        get().trackInteraction();
      },
      
      resetDailyTasks: () => {
        const today = new Date().toISOString().split('T')[0];
        const activeTemplates = get().routineTemplates.filter((r) => r.isActive);
        
        const newInstances: DailyTaskInstance[] = [];
        
        activeTemplates.forEach((template) => {
          // New logic: Iterate over goalIds instead of legacy tasks
          // For now, we skip generating granular instances since routines are just goal containers
          // TODO: Implement proper goal scheduling
        });
        
        set((state) => ({
          dailyTaskInstances: [...state.dailyTaskInstances.filter((t) => t.date !== today), ...newInstances],
        }));
        get().trackInteraction();
      },
      
      completeDailyTask: (id) => {
        const instance = get().dailyTaskInstances.find((t) => t.id === id);
        if (!instance || !instance.isUnlocked) return;
        
        set((state) => ({
          dailyTaskInstances: state.dailyTaskInstances.map((t) =>
            t.id === id ? { ...t, isCompleted: true, completedAt: new Date().toISOString() } : t
          ),
        }));
        
        const routineTasks = get().dailyTaskInstances.filter(
          (t) => t.routineTemplateId === instance.routineTemplateId && t.date === instance.date
        );
        const currentIdx = routineTasks.findIndex((t) => t.id === id);
        if (currentIdx < routineTasks.length - 1) {
          const nextTask = routineTasks[currentIdx + 1];
          set((state) => ({
            dailyTaskInstances: state.dailyTaskInstances.map((t) =>
              t.id === nextTask.id ? { ...t, isUnlocked: true } : t
            ),
          }));
        }
        
        get().trackInteraction();
      },
      
      // NEW: LIFE ROUTINE ACTIONS
      initializeLifeRoutines: () => {
        const existing = get().lifeRoutines;
        if (existing.length > 0) return; // Already initialized
        
        const lifeRoutines: LifeRoutine[] = [
          {
            id: 'lr-health',
            type: 'health',
            name: LIFE_ROUTINE_CONFIG.health.name,
            icon: LIFE_ROUTINE_CONFIG.health.icon,
            priority: LIFE_ROUTINE_CONFIG.health.priority,
            color: LIFE_ROUTINE_CONFIG.health.color,
            isActive: true,
            createdAt: new Date().toISOString(),
          },
          {
            id: 'lr-money',
            type: 'money',
            name: LIFE_ROUTINE_CONFIG.money.name,
            icon: LIFE_ROUTINE_CONFIG.money.icon,
            priority: LIFE_ROUTINE_CONFIG.money.priority,
            color: LIFE_ROUTINE_CONFIG.money.color,
            isActive: true,
            createdAt: new Date().toISOString(),
          },
        ];
        
        // SubRoutine initialization removed - Goals are now the primary entities
        set({ lifeRoutines });
      },
      
      saveDailySummary: (summary) => {
        const newSummary: DailySummary = {
          ...summary,
          id: generateId(),
          timestamp: new Date().toISOString(),
        };
        set((state) => ({
          dailySummaries: [...state.dailySummaries.filter((s) => s.date !== summary.date), newSummary],
        }));
        get().trackInteraction();
      },
      
      getDailySummary: (date) => {
        return get().dailySummaries.find((s) => s.date === date) || null;
      },
      
      updateSettings: (settings) => {
        set((state) => ({
          userSettings: { ...state.userSettings, ...settings },
        }));
        get().trackInteraction();
      },
      
      // TRACKING ACTIONS
      trackAppOpen: () => {
        const now = new Date();
        const storedLastOpen = get().lastAppOpen;
        const lastOpen = storedLastOpen ? new Date(storedLastOpen) : null;
        
        if (!lastOpen || (now.getTime() - lastOpen.getTime()) > 4 * 60 * 60 * 1000) {
          const today = now.toISOString().split('T')[0];
          const wakeUpTime = now.toISOString();
          
          const lastInteraction = get().lastInteraction;
          if (lastInteraction) {
            const lastDate = new Date(lastInteraction);
            const yesterday = new Date(lastDate);
            yesterday.setDate(yesterday.getDate());
            const yesterdayStr = yesterday.toISOString().split('T')[0];
            
            if (yesterdayStr !== today) {
              const sleepDuration = Math.round((now.getTime() - lastDate.getTime()) / 60000);
              
              set((state) => ({
                dailyStats: [
                  ...state.dailyStats.filter((s) => s.date !== yesterdayStr),
                  {
                    date: yesterdayStr,
                    sleepTime: lastInteraction,
                    sleepDuration,
                    wakeUpTime: undefined,
                  },
                ],
              }));
            }
          }
          
          set((state) => ({
            dailyStats: [
              ...state.dailyStats.filter((s) => s.date !== today),
              {
                date: today,
                wakeUpTime,
                sleepTime: undefined,
                sleepDuration: undefined,
              },
            ],
          }));
        }
        
        set({ lastAppOpen: now.toISOString() });
      },
      
      trackInteraction: () => {
        set({ lastInteraction: new Date().toISOString() });
      },
      
      // DAILY CHECK-IN
      saveDailyCheckIn: (data) => {
        const today = new Date().toISOString().split('T')[0];
        const existing = get().dailyDataPoints.find((d) => d.date === today);
        
        const routineTasks = get().dailyTaskInstances.filter((t) => t.date === today);
        const completedRoutine = routineTasks.filter((t) => t.isCompleted).length;
        const totalRoutine = routineTasks.length;
        
        const merged: DailyDataPoint = {
          id: existing?.id || generateId(),
          date: today,
          timestamp: new Date().toISOString(),
          physicalHealth: { ...existing?.physicalHealth, ...data.physicalHealth } as PhysicalHealth,
          mentalWellness: { ...existing?.mentalWellness, ...data.mentalWellness } as MentalWellness,
          productivity: { ...existing?.productivity, ...data.productivity } as Productivity,
          social: { ...existing?.social, ...data.social } as Social,
          financial: { ...existing?.financial, ...data.financial } as Financial,
          environment: { ...existing?.environment, ...data.environment } as Environment,
          routineTasksCompleted: completedRoutine,
          routineTasksTotal: totalRoutine,
          routineCompletionPercentage: totalRoutine > 0 ? Math.round((completedRoutine / totalRoutine) * 100) : 0,
          dataCompleteness: 0,
          isFullyLogged: false,
        };
        
        set((state) => ({
          dailyDataPoints: [...state.dailyDataPoints.filter((d) => d.date !== today), merged],
        }));
        get().trackInteraction();
      },
      
      getTodayCheckIn: () => {
        const today = new Date().toISOString().split('T')[0];
        return get().dailyDataPoints.find((d) => d.date === today) || null;
      },
      
      // COMPUTED
      getGoalProgress: (goalId) => {
        const links = get().links.filter((l) => l.goalId === goalId);
        let totalProgress = 0;
        
        for (const link of links) {
          const task = get().tasks.find((t) => t.id === link.taskId);
          if (!task) continue;
          
          const taskProgress = task.isRepeating
            ? task.completedCount / task.requiredCount
            : task.isCompleted
            ? 1
            : 0;
          
          totalProgress += taskProgress * (link.contributionWeight / 100);
        }
        
        return Math.min(100, Math.round(totalProgress * 100));
      },
      
      getTasksForGoal: (goalId) => {
        const links = get().links.filter((l) => l.goalId === goalId);
        const taskIds = links.map((l) => l.taskId);
        return get().tasks.filter((t) => taskIds.includes(t.id));
      },
      
      getGoalsForTask: (taskId) => {
        const links = get().links.filter((l) => l.taskId === taskId);
        const goalIds = links.map((l) => l.goalId);
        return get().goals.filter((g) => goalIds.includes(g.id));
      },
      
      getLinksForTask: (taskId) => {
        return get().links.filter((l) => l.taskId === taskId);
      },
      
      getLinksForGoal: (goalId) => {
        return get().links.filter((l) => l.goalId === goalId);
      },
      
      getTodayRoutineTasks: () => {
        const today = new Date().toISOString().split('T')[0];
        return get().dailyTaskInstances.filter((t) => t.date === today);
      },
      
      getRoutineProgress: (routineType) => {
        const today = new Date().toISOString().split('T')[0];
        const template = get().routineTemplates.find((r) => r.type === routineType);
        if (!template) return { completed: 0, total: 0 };
        
        const tasks = get().dailyTaskInstances.filter(
          (t) => t.routineTemplateId === template.id && t.date === today
        );
        
        return {
          completed: tasks.filter((t) => t.isCompleted).length,
          total: tasks.length,
        };
      },
      
      // NEW: Life Routine Computed
      getLifeRoutineProgress: (lifeRoutineType) => {
        const lifeRoutine = get().lifeRoutines.find((lr) => lr.type === lifeRoutineType);
        if (!lifeRoutine) return { completed: 0, total: 0, percentage: 0 };
        
        // SubRoutines removed. Progress calculation deferred until Goal linkage is established.
        return { completed: 0, total: 0, percentage: 0 };
      },
      
      // Goal Timeline Stats
      getGoalTimelineStats: (goalId) => {
        const goal = get().goals.find((g) => g.id === goalId);
        if (!goal) return { daysToComplete: null, totalDays: 0, tasksCompleted: 0, tasksTotal: 0 };
        
        const tasks = get().tasks.filter((t) => t.goalId === goalId);
        const tasksCompleted = tasks.filter((t) => t.isCompleted).length;
        const tasksTotal = tasks.length;
        
        const createdAt = new Date(goal.createdAt);
        const now = new Date();
        const totalDays = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
        
        let daysToComplete: number | null = null;
        if (goal.status === 'completed' && goal.completedAt) {
          const completedAt = new Date(goal.completedAt);
          daysToComplete = Math.floor((completedAt.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
        }
        
        return { daysToComplete, totalDays, tasksCompleted, tasksTotal };
      },
      
      // ACTIVITY
      logActivity: (entry) => {
        const activity: ActivityEntry = {
          id: generateId(),
          timestamp: new Date().toISOString(),
          ...entry,
        };
        set((state) => ({ activities: [activity, ...state.activities].slice(0, 100) }));
      },
      
      getRecentActivity: (limit = 10) => {
        return get().activities.slice(0, limit);
      },
      
      // TIMELINE EVENTS
      logTimelineEvent: (eventType, goalId, taskId, details) => {
        const event: TimelineEvent = {
          id: generateId(),
          timestamp: new Date().toISOString(),
          eventType,
          goalId,
          taskId,
          details,
        };
        set((state) => ({ 
          timelineEvents: [event, ...state.timelineEvents].slice(0, 500) // Keep last 500 events
        }));
      },
      
      getTimelineEvents: (limit = 50) => {
        return get().timelineEvents.slice(0, limit);
      },
      
      getTimelineEventsForGoal: (goalId) => {
        return get().timelineEvents.filter((e) => e.goalId === goalId);
      },
      
      // NODE POSITIONS
      saveNodePosition: (nodeId, position) => {
        set((state) => ({
          nodePositions: { ...state.nodePositions, [nodeId]: position },
        }));
      },
      
      clearNodePositions: () => {
        set({ nodePositions: {} });
      },
      
      // UTILITY
      loadSampleData: () => {
        const year = new Date().getFullYear();
        
        const yearlyGoal: Goal = {
          id: 'goal-1',
          title: 'Become a Full-Stack Developer',
          description: 'Master both frontend and backend development',
          level: 'yearly',
          metadata: { type: 'yearly', year },
          status: 'not_started',

          createdAt: new Date().toISOString(),
          isArchived: false,
        };
        
        const task1: Task = {
          id: 'task-1',
          title: 'Watch React tutorial videos',
          description: '20 videos to complete',
          goalId: 'goal-1',
          isRepeating: true,
          requiredCount: 20,
          completedCount: 12,
          isCompleted: false,

          createdAt: new Date().toISOString(),
          isArchived: false,
        };
        
        set({
          goals: [yearlyGoal],
          tasks: [task1],
          links: [],
          activities: [],
        });
      },
      
      loadDefaultRoutines: () => {
        const routines: RoutineTemplate[] = [
          {
            id: 'routine-morning',
            name: 'Morning Routine',
            type: 'morning',
            startTime: '06:00',
            endTime: '09:00',
            isActive: true,
            createdAt: new Date().toISOString(),
            goalIds: [],
          },
          {
            id: 'routine-work',
            name: 'Work Routine',
            type: 'work',
            startTime: '09:00',
            endTime: '17:00',
            isActive: true,
            createdAt: new Date().toISOString(),
            goalIds: [],
          },
          {
            id: 'routine-evening',
            name: 'Evening Routine',
            type: 'evening',
            startTime: '18:00',
            endTime: '22:00',
            isActive: true,
            createdAt: new Date().toISOString(),
            goalIds: [],
          },
          {
            id: 'routine-leisure',
            name: 'Leisure Time',
            type: 'leisure',
            startTime: '14:00',
            endTime: '18:00',
            isActive: true,
            createdAt: new Date().toISOString(),
            goalIds: [],
          },
        ];
        
        set({ routineTemplates: routines });
      },

      // NEW: Sleep/Wake Actions Implementation
      recordWakeUp: (adjustedMinutes = 0, mood) => {
        const today = new Date().toISOString().split('T')[0];
        const now = new Date();
        
        // Adjust time if needed
        if (adjustedMinutes !== 0) {
          now.setMinutes(now.getMinutes() - adjustedMinutes);
        }
        
        const timeString = now.toLocaleTimeString('en-US', { 
          hour12: false, 
          hour: '2-digit', 
          minute: '2-digit',
          timeZone: 'Asia/Kolkata' 
        });

        set((state) => {
          const existingLog = state.sleepWakeLogs.find(l => l.date === today);
          
          if (existingLog) {
            // Update existing
            return {
              sleepWakeLogs: state.sleepWakeLogs.map(l => 
                l.date === today 
                  ? { 
                      ...l, 
                      wakeUpTime: timeString, 
                      wakeUpConfirmedAt: new Date().toISOString(),
                      wakeUpAdjustedMinutes: adjustedMinutes,
                      wakeUpMood: mood || l.wakeUpMood,
                      updatedAt: new Date().toISOString()
                    } 
                  : l
              )
            };
          } else {
            // Create new
            const newLog: SleepWakeLog = {
              id: generateId(),
              date: today,
              wakeUpTime: timeString,
              wakeUpConfirmedAt: new Date().toISOString(),
              wakeUpAdjustedMinutes: adjustedMinutes,
              wakeUpMood: mood,
              sleepAttempts: [],
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };
            return { sleepWakeLogs: [...state.sleepWakeLogs, newLog] };
          }
        });
      },

      recordSleep: () => {
        const today = new Date().toISOString().split('T')[0];
        const now = new Date();
        const timeString = now.toLocaleTimeString('en-US', { 
          hour12: false, 
          hour: '2-digit', 
          minute: '2-digit',
          timeZone: 'Asia/Kolkata' 
        });
        const timestamp = now.toISOString();

        set((state) => {
          const existingLog = state.sleepWakeLogs.find(l => l.date === today);
          
          if (existingLog) {
            return {
              sleepWakeLogs: state.sleepWakeLogs.map(l => 
                l.date === today 
                  ? { 
                      ...l, 
                      sleepTime: timeString,
                      sleepAttempts: [...l.sleepAttempts, timestamp],
                      updatedAt: timestamp
                    } 
                  : l
              )
            };
          } else {
            const newLog: SleepWakeLog = {
              id: generateId(),
              date: today,
              sleepTime: timeString,
              sleepAttempts: [timestamp],
              createdAt: timestamp,
              updatedAt: timestamp,
            };
            return { sleepWakeLogs: [...state.sleepWakeLogs, newLog] };
          }
        });
      },

      getTodaySleepLog: () => {
        const today = new Date().toISOString().split('T')[0];
        return get().sleepWakeLogs.find(l => l.date === today) || null;
      },

      getSleepLogs: (days = 7) => {
        // Return last N days sorted by date desc
        return get().sleepWakeLogs
          .sort((a, b) => b.date.localeCompare(a.date))
          .slice(0, days);
      },

      getSleepStats: () => {
        const logs = get().sleepWakeLogs;
        if (logs.length === 0) {
          return {
            averageSleepDuration: 0,
            averageWakeUpTime: '00:00',
            averageSleepTime: '00:00',
            averageMood: 0,
            sleepDebtMinutes: 0,
            streakDays: 0,
          };
        }

        // Calculate Stats
        let totalDuration = 0;
        let totalMood = 0;
        let moodCount = 0;
        let sleepDebt = 0;
        const targetSleepMinutes = 8 * 60; // 8 hours

        logs.forEach(log => {
          // Duration
          if (log.sleepDurationMinutes) {
            totalDuration += log.sleepDurationMinutes;
            sleepDebt += (targetSleepMinutes - log.sleepDurationMinutes);
          }
           
          // Mood
          if (log.wakeUpMood) {
            totalMood += log.wakeUpMood;
            moodCount++;
          }
        });

        // Current Streak
        const sortedLogs = [...logs].sort((a, b) => b.date.localeCompare(a.date));
        let streak = 0;
        const today = new Date();
        // Check if today or yesterday is logged to start streak
        const todayStr = today.toISOString().split('T')[0];
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];

        if (sortedLogs[0].date !== todayStr && sortedLogs[0].date !== yesterdayStr) {
           streak = 0;
        } else {
           // Iterate backwards
           for (let i = 0; i < sortedLogs.length; i++) {
             const logDate = new Date(sortedLogs[i].date);
                          
             if (i === 0) {
                streak = 1;
             } else {
               // If exactly 1 day difference from previous
               const prevLogDate = new Date(sortedLogs[i-1].date);
               const diffParams = (prevLogDate.getTime() - logDate.getTime()) / (1000 * 3600 * 24);
               if (Math.round(diffParams) === 1) {
                 streak++;
               } else {
                 break;
               }
             }
           }
        }

        return {
          averageSleepDuration: Math.round(totalDuration / logs.length),
          averageWakeUpTime: '07:00', // Placeholder - complex to average times circularly
          averageSleepTime: '23:00', // Placeholder
          averageMood: moodCount > 0 ? Number((totalMood / moodCount).toFixed(1)) : 0,
          sleepDebtMinutes: sleepDebt,
          streakDays: streak,
        };
      },


      
      clearAll: () => {
        set({
          goals: [],
          tasks: [],
          links: [],
          activities: [],
          routineTemplates: [],
          dailyTaskInstances: [],
          dailyStats: [],
          dailyDataPoints: [],
          lifeRoutines: [],

          dailySummaries: [],
        });
      },
    }),
    {
      name: 'goal-tracker-storage',
    }
  )
);
