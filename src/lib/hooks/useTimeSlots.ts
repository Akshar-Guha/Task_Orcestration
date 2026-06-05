import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { getCurrentUserId } from '../user';
import type { TimeSlot, CreateTimeSlotInput } from '../types';
import { TIME_SLOT_COLORS } from '../constants';

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
      queryClient.invalidateQueries({ queryKey: ['timeslots'] });
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
      queryClient.invalidateQueries({ queryKey: ['timeslots'] });
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
      queryClient.invalidateQueries({ queryKey: ['timeslots'] });
    },
  });
}