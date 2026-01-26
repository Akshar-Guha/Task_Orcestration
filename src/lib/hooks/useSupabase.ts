/**
 * Supabase React Query Hooks
 * 
 * Direct database access with React Query caching.
 * NO Zustand state - Supabase is the single source of truth.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { getCurrentUserId } from '../user';
import type { Goal, Task, 
  TimeSlot, 
  TimelineEvent, 
  TimelineEventType,
  SleepWakeLog,
  MoodLevel,
  TaskGoalLink,
  CreateTimeSlotInput,
} from '../types';
import { TIME_SLOT_COLORS } from '../types';

// ============================================
// TIMELINE EVENTS
// ============================================

export function useTimelineEvents() {
  const userId = getCurrentUserId();
  
  return useQuery({
    queryKey: ['timeline_events', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('timeline_events')
        .select('*')
        .eq('user_id', userId)
        .order('timestamp', { ascending: false })
        .limit(100);
        
      if (error) throw error;
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (data || []).map((event: any): TimelineEvent => ({
        id: event.id,
        userId: event.user_id,
        eventType: event.event_type as TimelineEventType,
        timestamp: event.timestamp,
        details: event.details,
        metadata: event.metadata,
        relatedId: event.related_id,
        taskId: event.task_id,
        goalId: event.goal_id,
      }));
    },
  });
}

// ============================================
// GOALS
// ============================================

export function useGoals() {
  const userId = getCurrentUserId();
  
  return useQuery({
    queryKey: ['goals', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('goals')
        .select('*')
        .eq('user_id', userId)
        .eq('is_archived', false)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (data || []).map((g: any): Goal => ({
        id: g.id,
        title: g.title,
        description: g.description,
        level: g.level,
        metadata: g.metadata,
        status: g.status,
        priority: g.priority || 2,
        dependsOn: g.depends_on,
        unlocks: g.unlocks,
        timeSlotId: g.time_slot_id,
        createdAt: g.created_at,
        startedAt: g.started_at,
        completedAt: g.completed_at,
        lastActivityAt: g.last_activity_at,
        completionSnapshot: g.completion_snapshot,
        isArchived: g.is_archived,
        deadline: g.deadline,
      }));
    },
  });
}

export function useUpdateGoal() {
  const queryClient = useQueryClient();
  const userId = getCurrentUserId();
  
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Goal> }) => {
      const { data, error } = await supabase
        .from('goals')
        .update({
          title: updates.title,
          description: updates.description,
          status: updates.status,
          priority: updates.priority,
          depends_on: updates.dependsOn,
          unlocks: updates.unlocks,
          time_slot_id: updates.timeSlotId,
          deadline: updates.deadline,
          started_at: updates.startedAt,
          completed_at: updates.completedAt,
          last_activity_at: updates.lastActivityAt,
        })
        .eq('id', id)
        .eq('user_id', userId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals'] });
    },
  });
}

export function useDeleteGoal() {
  const queryClient = useQueryClient();
  const userId = getCurrentUserId();
  
  return useMutation({
    mutationFn: async (goalId: string) => {
      const { error } = await supabase
        .from('goals')
        .delete()
        .eq('id', goalId)
        .eq('user_id', userId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

export function useAddGoal() {
  const queryClient = useQueryClient();
  const userId = getCurrentUserId();
  
  return useMutation({
    mutationFn: async (input: {
      title: string;
      description?: string;
      level: string;
      metadata: Record<string, unknown>;
      priority?: 1 | 2 | 3;
      timeSlotId?: string;
      deadline?: string;
    }) => {
      const { data, error } = await supabase
        .from('goals')
        .insert({
          user_id: userId,
          title: input.title,
          description: input.description,
          level: input.level,
          metadata: input.metadata,
          status: 'not_started',
          priority: input.priority || 2,
          time_slot_id: input.timeSlotId,
          deadline: input.deadline,
          is_archived: false,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals'] });
    },
  });
}

export function useStartGoal() {
  const queryClient = useQueryClient();
  const userId = getCurrentUserId();
  
  return useMutation({
    mutationFn: async (goalId: string) => {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from('goals')
        .update({
          status: 'in_progress',
          started_at: now,
          last_activity_at: now,
        })
        .eq('id', goalId)
        .eq('user_id', userId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals'] });
    },
  });
}

export function useCompleteGoalMutation() {
  const queryClient = useQueryClient();
  const userId = getCurrentUserId();
  
  return useMutation({
    mutationFn: async ({ goalId, snapshot }: { 
      goalId: string; 
      snapshot?: {
        totalTasks: number;
        completedTasks: number;
        daysToComplete: number;
        activeDays: number;
        totalMinutesSpent: number;
      };
    }) => {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from('goals')
        .update({
          status: 'completed',
          completed_at: now,
          completion_snapshot: snapshot,
        })
        .eq('id', goalId)
        .eq('user_id', userId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals'] });
    },
  });
}

export function useArchiveGoal() {
  const queryClient = useQueryClient();
  const userId = getCurrentUserId();
  
  return useMutation({
    mutationFn: async (goalId: string) => {
      const { data, error } = await supabase
        .from('goals')
        .update({ is_archived: true })
        .eq('id', goalId)
        .eq('user_id', userId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals'] });
    },
  });
}

// ============================================
// TASKS
// ============================================

export function useTasks() {
  const userId = getCurrentUserId();
  
  return useQuery({
    queryKey: ['tasks', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', userId)
        .eq('is_archived', false)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      return (data || []).map((t: Record<string, unknown>): Task => ({
        id: t.id as string,
        title: t.title as string,
        description: t.description as string | undefined,
        goalId: t.goal_id as string | undefined,
        estimatedMinutes: t.estimated_minutes as number,
        actualMinutes: t.actual_minutes as number | undefined,
        isDaily: t.is_daily as boolean,
        isCompleted: t.is_completed as boolean,
        completedAt: t.completed_at as string | undefined,
        createdAt: t.created_at as string,
        isArchived: t.is_archived as boolean,
      }));
    },
  });
}

export function useUpdateTask() {
  const queryClient = useQueryClient();
  const userId = getCurrentUserId();
  
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Task> }) => {
      const { data, error } = await supabase
        .from('tasks')
        .update({
          title: updates.title,
          description: updates.description,
          goal_id: updates.goalId,
          estimated_minutes: updates.estimatedMinutes,
          actual_minutes: updates.actualMinutes,
          is_daily: updates.isDaily,
          is_completed: updates.isCompleted,
          completed_at: updates.completedAt,
        })
        .eq('id', id)
        .eq('user_id', userId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

export function useCompleteTask() {
  const queryClient = useQueryClient();
  const userId = getCurrentUserId();
  
  return useMutation({
    mutationFn: async (task: Task) => {
      const now = new Date().toISOString();
      const today = now.split('T')[0];
      
      // 1. Mark task as completed
      const { data: taskData, error: taskError } = await supabase
        .from('tasks')
        .update({
          is_completed: true,
          completed_at: now,
        })
        .eq('id', task.id)
        .eq('user_id', userId)
        .select()
        .single();
      
      if (taskError) throw taskError;

      // 2. Update Productivity Log
      // Fetch existing or init default
      const { data: existingLog } = await supabase
        .from('productivity_logs')
        .select('*')
        .eq('user_id', userId)
        .eq('date', today)
        .single();
        
      const currentMinutes = existingLog?.productive_minutes || 0;
      const newMinutes = currentMinutes + task.estimatedMinutes;
      
      const { error: logError } = await supabase
        .from('productivity_logs')
        .upsert({
          user_id: userId,
          date: today,
          productive_minutes: newMinutes,
          updated_at: now
        }, { onConflict: 'date,user_id' });
        
      if (logError) throw logError;

      return taskData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['productivity'] });
    },
  });
}

export function useDeleteTask() {
  const queryClient = useQueryClient();
  const userId = getCurrentUserId();
  
  return useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId)
        .eq('user_id', userId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

export function useAddTask() {
  const queryClient = useQueryClient();
  const userId = getCurrentUserId();
  
  return useMutation({
    mutationFn: async (input: {
      title: string;
      description?: string;
      goalId?: string;
      estimatedMinutes: number;
      isDaily?: boolean;
    }) => {
      const { data, error } = await supabase
        .from('tasks')
        .insert({
          user_id: userId,
          title: input.title,
          description: input.description,
          goal_id: input.goalId,
          estimated_minutes: input.estimatedMinutes,
          is_daily: input.isDaily !== false, // Default true
          is_completed: false,
          is_archived: false,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

export function useArchiveTask() {
  const queryClient = useQueryClient();
  const userId = getCurrentUserId();
  
  return useMutation({
    mutationFn: async (taskId: string) => {
      const { data, error } = await supabase
        .from('tasks')
        .update({ is_archived: true })
        .eq('id', taskId)
        .eq('user_id', userId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

export function useUncompleteTask() {
  const queryClient = useQueryClient();
  const userId = getCurrentUserId();
  
  return useMutation({
    mutationFn: async (taskId: string) => {
      const { data, error } = await supabase
        .from('tasks')
        .update({
          is_completed: false,
          completed_at: null,
        })
        .eq('id', taskId)
        .eq('user_id', userId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

// ============================================
// TIME SLOTS
// ============================================

export function useTimeSlots() {
  const userId = getCurrentUserId();
  
  return useQuery({
    queryKey: ['timeslots', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('time_slots')
        .select('*')
        .eq('user_id', userId)
        .order('start_time', { ascending: true });
      
      if (error) throw error;
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (data || []).map((s: any): TimeSlot => ({
        id: s.id,
        userId: s.user_id,
        name: s.name,
        type: s.type,
        startTime: s.start_time,
        endTime: s.end_time,
        color: s.color,
        goalIds: s.goal_ids || [],
        isActive: s.is_active,
        isNotificationEnabled: s.is_notification_enabled ?? true,
        createdAt: s.created_at,
      }));
    },
  });
}

// ============================================
// PRODUCTIVITY & ANALYTICS
// ============================================

export function useProductivity() {
  const userId = getCurrentUserId();
  
  return useQuery({
    queryKey: ['productivity', userId],
    queryFn: async () => {
      // Use local date for "Today"
      const today = new Date().toISOString().split('T')[0];
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const weekAgoStr = weekAgo.toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from('productivity_logs')
        .select('*')
        .eq('user_id', userId)
        .gte('date', weekAgoStr);
        
      if (error) throw error;
      
      const logs = data || [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const todayLog = logs.find((l: any) => l.date === today);
      const productiveMinutes = todayLog?.productive_minutes || 0;
      
      // Default waking hours (16h) if not found - TODO: Fetch from settings
      const totalWaking = 16 * 60;
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const weekMinutes = logs.reduce((sum: number, l: any) => sum + (l.productive_minutes || 0), 0);
      
      return {
        todayMinutes: productiveMinutes,
        todayPercentage: Math.round((productiveMinutes / totalWaking) * 100),
        weekMinutes,
        weeklyAverage: Math.round(weekMinutes / 7),
        logs,
      };
    },
  });
}

// ============================================
// SLEEP / WAKE
// ============================================

export function useSleepLogs() {
  const userId = getCurrentUserId();
  
  return useQuery({
    queryKey: ['sleep_logs', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sleep_wake_logs')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: false })
        .limit(7);
        
      if (error) throw error;
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (data || []).map((log: any): SleepWakeLog => ({
        id: log.id,
        date: log.date,
        wakeUpTime: log.wake_up_time,
        wakeUpConfirmedAt: log.wake_up_confirmed_at,
        wakeUpMood: log.wake_up_mood,
        sleepTime: log.sleep_time,
        sleepAttempts: log.sleep_attempts || [],
        sleepDurationMinutes: log.sleep_duration_minutes,
        notes: log.notes,
        createdAt: log.created_at,
        updatedAt: log.updated_at,
      }));
    },
  });
}

export function useRecordWakeUp() {
  const queryClient = useQueryClient();
  const userId = getCurrentUserId();
  
  return useMutation({
    mutationFn: async ({ adjustedMinutes, mood }: { adjustedMinutes: number, mood: MoodLevel }) => {
      const today = new Date().toISOString().split('T')[0];
      const now = new Date();
      now.setMinutes(now.getMinutes() - adjustedMinutes);
      const wakeUpTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      
      const { data, error } = await supabase
        .from('sleep_wake_logs')
        .upsert({
          user_id: userId,
          date: today,
          wake_up_time: wakeUpTime,
          wake_up_mood: mood,
          wake_up_confirmed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }, { onConflict: 'date,user_id' })
        .select()
        .single();
        
      if (error) throw error;
      
      // Trigger email (Fire and forget)
      try {
        const { triggerWakeUpEmail } = await import('../emailTrigger');
        const moodMap: Record<number, string> = {
          5: 'great',
          4: 'good',
          3: 'okay',
          2: 'bad',
          1: 'terrible'
        };
        triggerWakeUpEmail(moodMap[mood] || 'good').catch(console.error);
      } catch (e) {
        console.error("Failed to trigger wake up email", e);
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sleep_logs'] });
    }
  });
}

export function useRecordSleep() {
  const queryClient = useQueryClient();
  const userId = getCurrentUserId();
  
  return useMutation({
    mutationFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const now = new Date();
      const sleepTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      
      // 1. Get existing log to append attempt
      const { data: existing } = await supabase
        .from('sleep_wake_logs')
        .select('*')
        .eq('user_id', userId)
        .eq('date', today)
        .single();
        
      const sleepAttempts = existing?.sleep_attempts || [];
      sleepAttempts.push(new Date().toISOString());
      
      const { data, error } = await supabase
        .from('sleep_wake_logs')
        .upsert({
          user_id: userId,
          date: today,
          sleep_time: sleepTime,
          sleep_attempts: sleepAttempts,
          updated_at: new Date().toISOString()
        }, { onConflict: 'date,user_id' })
        .select()
        .single();
        
      if (error) throw error;
      
      // Trigger email
        try {
          const { triggerSleepEmail } = await import('../emailTrigger');
          triggerSleepEmail().catch(console.error);
        } catch (e) {
          console.error("Failed to trigger sleep email", e);
        }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sleep_logs'] });
    }
  });
}

// ============================================
// SETTINGS
// ============================================

export function useUserSettings() {
  const userId = getCurrentUserId();
  
  return useQuery({
    queryKey: ['user_settings', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', userId)
        .single();
        
      if (error && error.code !== 'PGRST116') throw error; // PGRST116 is "no rows found"
      
      return {
        id: data?.id,
        userId: data?.user_id,
        theme: data?.theme || 'dark', // Default
        dailySummaryTime: data?.daily_summary_time || '20:00', // Default
        enableDailySummaryReminder: data?.enable_daily_summary_reminder ?? true,
        // Map other fields as needed
        // Notification settings
        dailyMorningTime: data?.daily_morning_time || '07:00',
        enableMorningReminder: data?.enable_morning_reminder ?? true,
        enableTaskNotifications: data?.enable_task_notifications ?? true,
        enableGoalNotifications: data?.enable_goal_notifications ?? true,
        notificationOffsetMinutes: data?.notification_offset_minutes ?? 5,
        
        data: data // Keep raw data accessible if needed
      };
    },
  });
}

export function useUpdateUserSettings() {
  const queryClient = useQueryClient();
  const userId = getCurrentUserId();
  
  return useMutation({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mutationFn: async (updates: Record<string, any>) => {
      // Map frontend camelCase to snake_case DB fields
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dbUpdates: Record<string, any> = {};
      if (updates.dailySummaryTime !== undefined) dbUpdates.daily_summary_time = updates.dailySummaryTime;
      if (updates.enableDailySummaryReminder !== undefined) dbUpdates.enable_daily_summary_reminder = updates.enableDailySummaryReminder;
      if (updates.theme !== undefined) dbUpdates.theme = updates.theme;
      
      // New notification fields
      if (updates.dailyMorningTime !== undefined) dbUpdates.daily_morning_time = updates.dailyMorningTime;
      if (updates.enableMorningReminder !== undefined) dbUpdates.enable_morning_reminder = updates.enableMorningReminder;
      if (updates.enableTaskNotifications !== undefined) dbUpdates.enable_task_notifications = updates.enableTaskNotifications;
      if (updates.enableGoalNotifications !== undefined) dbUpdates.enable_goal_notifications = updates.enableGoalNotifications;
      if (updates.notificationOffsetMinutes !== undefined) dbUpdates.notification_offset_minutes = updates.notificationOffsetMinutes;
      
      // Upsert to handle creation if not exists
      const { data, error } = await supabase
        .from('user_settings')
        .upsert({ 
          user_id: userId,
          updated_at: new Date().toISOString(),
          ...dbUpdates 
        }, { onConflict: 'user_id' })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user_settings'] });
    },
  });
}

// ============================================
// WAKE UP / DAILY RESET
// ============================================

export function useResetDailyTasks() {
  const queryClient = useQueryClient();
  const userId = getCurrentUserId();
  
  return useMutation({
    mutationFn: async () => {
      // Reset all daily tasks for the user
      const { error } = await supabase
        .from('tasks')
        .update({
          is_completed: false,
          completed_at: null,
          actual_minutes: null
        })
        .eq('user_id', userId)
        .eq('is_daily', true);
        
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

// ============================================
// LINKS
// ============================================

export function useTaskGoalLinks() {
  const userId = getCurrentUserId();
  
  return useQuery({
    queryKey: ['task_goal_links', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('task_goal_links')
        .select('*')
        .eq('user_id', userId);
        
      if (error) throw error;
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (data || []).map((link: any): TaskGoalLink => ({
        id: link.id,
        taskId: link.task_id,
        goalId: link.goal_id,
        contributionWeight: link.contribution_weight,
        createdAt: link.created_at,
      }));
    },
  });
}

// ============================================
// DATA MANAGEMENT
// ============================================

export function useAddTimeSlot() {
  const queryClient = useQueryClient();
  const userId = getCurrentUserId();
  
  return useMutation({
    mutationFn: async (input: CreateTimeSlotInput) => {
      // Upsert time slot 
      // Mapping camelCase to snake_case
      const { data, error } = await supabase
        .from('time_slots')
        .insert({
          user_id: userId,
          name: input.name,
          type: input.type,
          start_time: input.startTime,
          end_time: input.endTime,
          color: input.color || TIME_SLOT_COLORS[input.type],
          goal_ids: [],
          is_active: true,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();
        
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time_slots'] });
    },
  });
}

export function useClearUserData() {
  const queryClient = useQueryClient();
  const userId = getCurrentUserId();
  
  return useMutation({
    mutationFn: async () => {
      // Delete all user data in order of dependencies (optional, but RLS/Cascade might handle it)
      // Supabase cascade delete on user_id usually works if configured, but here we invoke explicit deletes if safer.
      const tables = ['productivity_logs', 'sleep_wake_logs', 'timeline_events', 'task_goal_links', 'tasks', 'goals', 'time_slots'];
      
      for (const table of tables) {
         const { error } = await supabase.from(table).delete().eq('user_id', userId);
         if (error) {
             console.error(`Failed to clear table ${table}:`, error);
             throw error;
         }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
    },
  });
}

export function useUpdateTimeSlot() {
  const queryClient = useQueryClient();
  const userId = getCurrentUserId();
  
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string, updates: Partial<TimeSlot> }) => {
      // Mapping updates to snake_case
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dbUpdates: Record<string, any> = {};
      if (updates.name) dbUpdates.name = updates.name;
      if (updates.type) dbUpdates.type = updates.type;
      if (updates.startTime) dbUpdates.start_time = updates.startTime;
      if (updates.endTime) dbUpdates.end_time = updates.endTime;
      if (updates.color) dbUpdates.color = updates.color;
      if (updates.goalIds) dbUpdates.goal_ids = updates.goalIds;
      if (updates.isActive !== undefined) dbUpdates.is_active = updates.isActive;
      if (updates.isNotificationEnabled !== undefined) dbUpdates.is_notification_enabled = updates.isNotificationEnabled;
      
      const { error } = await supabase
        .from('time_slots')
        .update(dbUpdates)
        .eq('id', id)
        .eq('user_id', userId);
        
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time_slots'] });
    },
  });
}

export function useDeleteTimeSlot() {
  const queryClient = useQueryClient();
  const userId = getCurrentUserId();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('time_slots')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);
        
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time_slots'] });
    },
  });
}
