import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { getCurrentUserId } from '../user';
import type { Task, TaskGoalLink } from '../types';

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

      // 3. Auto-update goal status based on task completions
      if (task.goalId) {
        const { data: goalTasks } = await supabase
          .from('tasks')
          .select('id, is_completed')
          .eq('user_id', userId)
          .eq('goal_id', task.goalId)
          .eq('is_archived', false);

        if (goalTasks && goalTasks.length > 0) {
          const allCompleted = goalTasks.every(t => t.id === task.id ? true : t.is_completed);
          const { data: goal } = await supabase
            .from('goals')
            .select('status')
            .eq('id', task.goalId)
            .eq('user_id', userId)
            .single();

          if (goal) {
            if (allCompleted && goal.status !== 'completed') {
              // All tasks done → mark goal completed
              await supabase
                .from('goals')
                .update({ status: 'completed', completed_at: now, last_activity_at: now })
                .eq('id', task.goalId)
                .eq('user_id', userId);
            } else if (!allCompleted && goal.status === 'not_started') {
              // First task completed → mark goal in_progress
              await supabase
                .from('goals')
                .update({ status: 'in_progress', started_at: now, last_activity_at: now })
                .eq('id', task.goalId)
                .eq('user_id', userId);
            } else {
              // Just update last activity
              await supabase
                .from('goals')
                .update({ last_activity_at: now })
                .eq('id', task.goalId)
                .eq('user_id', userId);
            }
          }
        }
      }

      return taskData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['productivity'] });
      queryClient.invalidateQueries({ queryKey: ['goals'] });
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
    mutationFn: async (task: Task) => {
      const now = new Date().toISOString();
      const today = now.split('T')[0];

      // 1. Mark task as uncompleted
      const { data, error } = await supabase
        .from('tasks')
        .update({
          is_completed: false,
          completed_at: null,
        })
        .eq('id', task.id)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) throw error;

      // 2. Subtract minutes from today's productivity log
      const { data: existingLog } = await supabase
        .from('productivity_logs')
        .select('*')
        .eq('user_id', userId)
        .eq('date', today)
        .single();

      if (existingLog) {
        const currentMinutes = existingLog.productive_minutes || 0;
        const newMinutes = Math.max(0, currentMinutes - task.estimatedMinutes);

        await supabase
          .from('productivity_logs')
          .update({
            productive_minutes: newMinutes,
            updated_at: now,
          })
          .eq('user_id', userId)
          .eq('date', today);
      }

      // 3. Revert goal status if needed
      if (task.goalId) {
        const { data: goal } = await supabase
          .from('goals')
          .select('status')
          .eq('id', task.goalId)
          .eq('user_id', userId)
          .single();

        if (goal?.status === 'completed') {
          // Goal was completed but now a task is uncompleted → revert to in_progress
          await supabase
            .from('goals')
            .update({ status: 'in_progress', completed_at: null, last_activity_at: now })
            .eq('id', task.goalId)
            .eq('user_id', userId);
        }
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['productivity'] });
      queryClient.invalidateQueries({ queryKey: ['goals'] });
    },
  });
}
