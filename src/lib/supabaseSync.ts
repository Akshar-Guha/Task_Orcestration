/**
 * Supabase Sync Service
 * 
 * Provides bidirectional sync between Zustand store (localStorage) and Supabase.
 * Handles:
 * - Goals, Tasks, TimeSlots sync to nodes table
 * - Daily task status (per-day completion)
 * - Productivity logs
 */

import { supabase } from './supabase';
import type { Goal, Task, TimeSlot, ProductivityLog } from './types';

const USER_ID = process.env.NEXT_PUBLIC_USER_ID || '2c32a446-1bbc-4294-8a29-3e4fef5649e6';

// ============================================
// TYPES
// ============================================

interface DailyTaskStatus {
  id: string;
  taskId: string;
  date: string;
  isCompleted: boolean;
  completedAt?: string;
  minutesSpent: number;
}

interface SyncResult {
  success: boolean;
  error?: string;
}

// ============================================
// SYNC GOALS TO SUPABASE
// ============================================

export async function syncGoalToSupabase(goal: Goal): Promise<SyncResult> {
  try {
    const { error } = await supabase
      .from('nodes')
      .upsert({
        id: goal.id,
        type: 'goal',
        title: goal.title,
        description: goal.description || null,
        properties: {
          level: goal.level,
          status: goal.status,
          timeSlotId: goal.timeSlotId,
          startedAt: goal.startedAt,
          completedAt: goal.completedAt,
          lastActivityAt: goal.lastActivityAt,
          completionSnapshot: goal.completionSnapshot,
        },
        metadata: goal.metadata,
        is_archived: goal.isArchived,
        user_id: USER_ID,
      }, { onConflict: 'id' });

    if (error) throw error;
    return { success: true };
  } catch (err) {
    console.error('[Sync] Failed to sync goal:', err);
    return { success: false, error: String(err) };
  }
}

// ============================================
// SYNC TASKS TO SUPABASE
// ============================================

export async function syncTaskToSupabase(task: Task): Promise<SyncResult> {
  try {
    const { error } = await supabase
      .from('nodes')
      .upsert({
        id: task.id,
        type: 'task',
        title: task.title,
        description: task.description || null,
        properties: {
          goalId: task.goalId,
          estimatedMinutes: task.estimatedMinutes,
          actualMinutes: task.actualMinutes,
          isDaily: task.isDaily || true, // Default to daily tasks
          isCompleted: task.isCompleted,
          completedAt: task.completedAt,
        },
        metadata: {},
        is_archived: task.isArchived,
        user_id: USER_ID,
      }, { onConflict: 'id' });

    if (error) throw error;
    return { success: true };
  } catch (err) {
    console.error('[Sync] Failed to sync task:', err);
    return { success: false, error: String(err) };
  }
}

// ============================================
// SYNC TIME SLOTS TO SUPABASE
// ============================================

export async function syncTimeSlotToSupabase(slot: TimeSlot): Promise<SyncResult> {
  try {
    const { error } = await supabase
      .from('nodes')
      .upsert({
        id: slot.id,
        type: 'time_slot',
        title: slot.name,
        description: null,
        properties: {
          slotType: slot.type,
          startTime: slot.startTime,
          endTime: slot.endTime,
          color: slot.color,
          goalIds: slot.goalIds,
          isActive: slot.isActive,
        },
        metadata: {},
        is_archived: false,
        user_id: USER_ID,
      }, { onConflict: 'id' });

    if (error) throw error;
    return { success: true };
  } catch (err) {
    console.error('[Sync] Failed to sync time slot:', err);
    return { success: false, error: String(err) };
  }
}

// ============================================
// DAILY TASK STATUS (PER-DAY COMPLETION)
// ============================================

export async function saveDailyTaskStatus(
  taskId: string,
  date: string,
  isCompleted: boolean,
  minutesSpent: number = 0
): Promise<SyncResult> {
  try {
    const { error } = await supabase
      .from('daily_task_status')
      .upsert({
        task_id: taskId,
        date: date,
        is_completed: isCompleted,
        completed_at: isCompleted ? new Date().toISOString() : null,
        minutes_spent: minutesSpent,
        user_id: USER_ID,
      }, { onConflict: 'task_id,date,user_id' });

    if (error) throw error;
    return { success: true };
  } catch (err) {
    console.error('[Sync] Failed to save daily task status:', err);
    return { success: false, error: String(err) };
  }
}

export async function getDailyTaskStatus(date: string): Promise<DailyTaskStatus[]> {
  try {
    const { data, error } = await supabase
      .from('daily_task_status')
      .select('*')
      .eq('date', date)
      .eq('user_id', USER_ID);

    if (error) throw error;
    
    return (data || []).map(row => ({
      id: row.id,
      taskId: row.task_id,
      date: row.date,
      isCompleted: row.is_completed,
      completedAt: row.completed_at,
      minutesSpent: row.minutes_spent,
    }));
  } catch (err) {
    console.error('[Sync] Failed to get daily task status:', err);
    return [];
  }
}

// ============================================
// PRODUCTIVITY LOGS
// ============================================

export async function saveProductivityLog(log: ProductivityLog): Promise<SyncResult> {
  try {
    const { error } = await supabase
      .from('productivity_logs')
      .upsert({
        date: log.date,
        productive_minutes: log.productiveMinutes,
        completions: log.completions,
        wake_time: log.wakeTime,
        sleep_time: log.sleepTime,
        mood: log.mood,
        user_id: USER_ID,
      }, { onConflict: 'date,user_id' });

    if (error) throw error;
    return { success: true };
  } catch (err) {
    console.error('[Sync] Failed to save productivity log:', err);
    return { success: false, error: String(err) };
  }
}

export async function getProductivityLogs(days: number = 30): Promise<ProductivityLog[]> {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const { data, error } = await supabase
      .from('productivity_logs')
      .select('*')
      .eq('user_id', USER_ID)
      .gte('date', startDate.toISOString().split('T')[0])
      .order('date', { ascending: false });

    if (error) throw error;
    
    return (data || []).map(row => ({
      date: row.date,
      productiveMinutes: row.productive_minutes,
      completions: row.completions || [],
      wakeTime: row.wake_time,
      sleepTime: row.sleep_time,
      mood: row.mood,
    }));
  } catch (err) {
    console.error('[Sync] Failed to get productivity logs:', err);
    return [];
  }
}

// ============================================
// FETCH ALL DATA FROM SUPABASE
// ============================================

export async function fetchAllFromSupabase(): Promise<{
  goals: Goal[];
  tasks: Task[];
  timeSlots: TimeSlot[];
  productivityLogs: ProductivityLog[];
}> {
  try {
    // Fetch nodes
    const { data: nodes, error: nodesError } = await supabase
      .from('nodes')
      .select('*')
      .eq('user_id', USER_ID)
      .eq('is_archived', false);

    if (nodesError) throw nodesError;

    const goals: Goal[] = [];
    const tasks: Task[] = [];
    const timeSlots: TimeSlot[] = [];

    for (const node of nodes || []) {
      const props = node.properties || {};
      
      if (node.type === 'goal') {
        goals.push({
          id: node.id,
          title: node.title,
          description: node.description || undefined,
          level: props.level || 'yearly',
          metadata: node.metadata || { type: 'yearly', year: new Date().getFullYear() },
          status: props.status || 'not_started',
          timeSlotId: props.timeSlotId,
          completionSnapshot: props.completionSnapshot,
          createdAt: node.created_at,
          startedAt: props.startedAt,
          completedAt: props.completedAt,
          lastActivityAt: props.lastActivityAt,
          isArchived: node.is_archived,
        });
      } else if (node.type === 'task') {
        tasks.push({
          id: node.id,
          title: node.title,
          description: node.description || undefined,
          goalId: props.goalId,
          estimatedMinutes: props.estimatedMinutes || 30,
          actualMinutes: props.actualMinutes,
          isDaily: props.isDaily !== false, // Default true
          isCompleted: props.isCompleted || false,
          createdAt: node.created_at,
          completedAt: props.completedAt,
          isArchived: node.is_archived,
        });
      } else if (node.type === 'time_slot') {
        timeSlots.push({
          id: node.id,
          name: node.title,
          type: props.slotType || 'custom',
          startTime: props.startTime || '09:00',
          endTime: props.endTime || '17:00',
          color: props.color || '#8b5cf6',
          goalIds: props.goalIds || [],
          isActive: props.isActive !== false,
          createdAt: node.created_at,
        });
      }
    }

    // Fetch productivity logs
    const productivityLogs = await getProductivityLogs(30);

    return { goals, tasks, timeSlots, productivityLogs };
  } catch (err) {
    console.error('[Sync] Failed to fetch all data:', err);
    return { goals: [], tasks: [], timeSlots: [], productivityLogs: [] };
  }
}

// ============================================
// FULL SYNC (PUSH ALL LOCAL DATA TO SUPABASE)
// ============================================

export async function pushAllToSupabase(
  goals: Goal[],
  tasks: Task[],
  timeSlots: TimeSlot[],
  productivityLogs: ProductivityLog[]
): Promise<SyncResult> {
  console.log('[Sync] Starting full push to Supabase...');
  
  const errors: string[] = [];

  // Sync goals
  for (const goal of goals) {
    const result = await syncGoalToSupabase(goal);
    if (!result.success) errors.push(`Goal ${goal.id}: ${result.error}`);
  }

  // Sync tasks
  for (const task of tasks) {
    const result = await syncTaskToSupabase(task);
    if (!result.success) errors.push(`Task ${task.id}: ${result.error}`);
  }

  // Sync time slots
  for (const slot of timeSlots) {
    const result = await syncTimeSlotToSupabase(slot);
    if (!result.success) errors.push(`TimeSlot ${slot.id}: ${result.error}`);
  }

  // Sync productivity logs
  for (const log of productivityLogs) {
    const result = await saveProductivityLog(log);
    if (!result.success) errors.push(`ProductivityLog ${log.date}: ${result.error}`);
  }

  if (errors.length > 0) {
    console.error('[Sync] Errors during push:', errors);
    return { success: false, error: errors.join('; ') };
  }

  console.log('[Sync] Full push completed successfully');
  return { success: true };
}

// ============================================
// DELETE FROM SUPABASE
// ============================================

export async function deleteFromSupabase(id: string): Promise<SyncResult> {
  try {
    const { error } = await supabase
      .from('nodes')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return { success: true };
  } catch (err) {
    console.error('[Sync] Failed to delete:', err);
    return { success: false, error: String(err) };
  }
}

// ============================================
// SAVE PREVIOUS DAY DATA BEFORE RESET
// ============================================

export async function saveArchiveBeforeReset(
  tasks: Task[],
  date: string
): Promise<SyncResult> {
  console.log(`[Sync] Archiving ${tasks.length} tasks for date ${date}`);
  
  const errors: string[] = [];
  
  for (const task of tasks) {
    if (task.isDaily) {
      const result = await saveDailyTaskStatus(
        task.id,
        date,
        task.isCompleted,
        task.actualMinutes || 0
      );
      if (!result.success) errors.push(`Task ${task.id}: ${result.error}`);
    }
  }

  if (errors.length > 0) {
    return { success: false, error: errors.join('; ') };
  }

  return { success: true };
}
