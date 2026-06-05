import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { getCurrentUserId } from '../user';
import type { Goal } from '../types';

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
      dependsOn?: string[];
      unlocks?: string[];
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
          depends_on: input.dependsOn || [],
          unlocks: input.unlocks || [],
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
