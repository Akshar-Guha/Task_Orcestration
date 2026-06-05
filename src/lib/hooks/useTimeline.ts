import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { getCurrentUserId } from '../user';
import type { TimelineEvent, TimelineEventType } from '../types';

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
