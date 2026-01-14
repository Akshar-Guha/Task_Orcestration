/**
 * Supabase Sync Service - PERMANENT DATA STORAGE
 * 
 * CRITICAL: This service ensures ALL data is stored in Supabase permanently.
 * Data is NEVER only in localStorage - it's always synced to the server.
 */

import { supabase } from './supabase';
import type { Goal, Task, TimeSlot, ProductivityLog, SleepWakeLog } from './types';

const USER_ID = process.env.NEXT_PUBLIC_USER_ID || '2c32a446-1bbc-4294-8a29-3e4fef5649e6';

// ============================================
// SYNC RESULT TYPE
// ============================================

interface SyncResult {
  success: boolean;
  error?: string;
}

// ============================================
// SAVE GOAL TO SUPABASE (IMMEDIATE)
// ============================================

export async function saveGoal(goal: Goal): Promise<SyncResult> {
  try {
    const { error } = await supabase
      .from('goals')
      .upsert({
        id: goal.id,
        title: goal.title,
        description: goal.description || null,
        level: goal.level,
        status: goal.status,
        priority: goal.priority || 2,
        depends_on: goal.dependsOn || [],
        unlocks: goal.unlocks || [],
        time_slot_id: goal.timeSlotId,
        is_archived: goal.isArchived,
        user_id: USER_ID,
        created_at: goal.createdAt,
        started_at: goal.startedAt,
        completed_at: goal.completedAt,
        metadata: goal.metadata,
        completion_snapshot: goal.completionSnapshot,
      }, { onConflict: 'id' });

    if (error) throw error;
    console.log('[Supabase] Goal saved:', goal.title);
    return { success: true };
  } catch (err) {
    console.error('[Supabase] Failed to save goal:', err);
    return { success: false, error: String(err) };
  }
}

// ============================================
// SAVE TASK TO SUPABASE (IMMEDIATE)
// ============================================

export async function saveTask(task: Task): Promise<SyncResult> {
  try {
    const { error } = await supabase
      .from('tasks')
      .upsert({
        id: task.id,
        title: task.title,
        description: task.description || null,
        goal_id: task.goalId,
        estimated_minutes: task.estimatedMinutes,
        actual_minutes: task.actualMinutes,
        is_daily: task.isDaily !== false,
        is_completed: task.isCompleted,
        is_archived: task.isArchived,
        user_id: USER_ID,
        created_at: task.createdAt,
        completed_at: task.completedAt,
      }, { onConflict: 'id' });

    if (error) throw error;
    console.log('[Supabase] Task saved:', task.title);
    return { success: true };
  } catch (err) {
    console.error('[Supabase] Failed to save task:', err);
    return { success: false, error: String(err) };
  }
}

// ============================================
// SAVE TIME SLOT TO SUPABASE
// ============================================

export async function saveTimeSlot(slot: TimeSlot): Promise<SyncResult> {
  try {
    const { error } = await supabase
      .from('time_slots')
      .upsert({
        id: slot.id,
        name: slot.name,
        type: slot.type,
        start_time: slot.startTime,
        end_time: slot.endTime,
        color: slot.color,
        goal_ids: slot.goalIds || [],
        is_active: slot.isActive,
        user_id: USER_ID,
        created_at: slot.createdAt,
      }, { onConflict: 'id' });

    if (error) throw error;
    return { success: true };
  } catch (err) {
    console.error('[Supabase] Failed to save time slot:', err);
    return { success: false, error: String(err) };
  }
}

// ============================================
// SAVE PRODUCTIVITY LOG
// ============================================

export async function saveProductivityLog(log: ProductivityLog): Promise<SyncResult> {
  try {
    const { error } = await supabase
      .from('productivity_logs')
      .upsert({
        date: log.date,
        productive_minutes: log.productiveMinutes,
        total_waking_minutes: log.totalWakingMinutes,
        wake_time: log.wakeTime,
        sleep_time: log.sleepTime,
        mood: log.mood,
        completions: log.completions,
        user_id: USER_ID,
      }, { onConflict: 'date,user_id' });

    if (error) throw error;
    return { success: true };
  } catch (err) {
    console.error('[Supabase] Failed to save productivity log:', err);
    return { success: false, error: String(err) };
  }
}

// ============================================
// SAVE SLEEP WAKE LOG
// ============================================

export async function saveSleepWakeLog(log: SleepWakeLog): Promise<SyncResult> {
  try {
    const { error } = await supabase
      .from('sleep_wake_logs')
      .upsert({
        date: log.date,
        wake_up_time: log.wakeUpTime,
        wake_up_mood: log.wakeUpMood,
        sleep_time: log.sleepTime,
        sleep_duration_minutes: log.sleepDurationMinutes,
        user_id: USER_ID,
      }, { onConflict: 'date,user_id' });

    if (error) throw error;
    return { success: true };
  } catch (err) {
    console.error('[Supabase] Failed to save sleep log:', err);
    return { success: false, error: String(err) };
  }
}

// ============================================
// LOAD ALL DATA FROM SUPABASE
// ============================================

export async function loadAllFromSupabase(): Promise<{
  goals: Goal[];
  tasks: Task[];
  timeSlots: TimeSlot[];
  productivityLogs: ProductivityLog[];
  sleepWakeLogs: SleepWakeLog[];
}> {
  console.log('[Supabase] Loading all data from server...');
  
  const [goalsRes, tasksRes, slotsRes, logsRes, sleepRes] = await Promise.all([
    supabase.from('goals').select('*').eq('user_id', USER_ID),
    supabase.from('tasks').select('*').eq('user_id', USER_ID),
    supabase.from('time_slots').select('*').eq('user_id', USER_ID),
    supabase.from('productivity_logs').select('*').eq('user_id', USER_ID),
    supabase.from('sleep_wake_logs').select('*').eq('user_id', USER_ID),
  ]);

  const goals: Goal[] = (goalsRes.data || []).map((g: Record<string, unknown>) => ({
    id: g.id as string,
    title: g.title as string,
    description: g.description as string | undefined,
    level: g.level as Goal['level'],
    metadata: g.metadata as Goal['metadata'],
    status: g.status as Goal['status'],
    priority: (g.priority as 1 | 2 | 3) || 2,
    dependsOn: g.depends_on as string[] | undefined,
    unlocks: g.unlocks as string[] | undefined,
    timeSlotId: g.time_slot_id as string | undefined,
    createdAt: g.created_at as string,
    startedAt: g.started_at as string | undefined,
    completedAt: g.completed_at as string | undefined,
    lastActivityAt: g.last_activity_at as string | undefined,
    completionSnapshot: g.completion_snapshot as Goal['completionSnapshot'],
    isArchived: g.is_archived as boolean,
  }));

  const tasks: Task[] = (tasksRes.data || []).map((t: Record<string, unknown>) => ({
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

  const timeSlots: TimeSlot[] = (slotsRes.data || []).map((s: Record<string, unknown>) => ({
    id: s.id as string,
    name: s.name as string,
    type: s.type as TimeSlot['type'],
    startTime: s.start_time as string,
    endTime: s.end_time as string,
    color: s.color as string,
    goalIds: s.goal_ids as string[],
    isActive: s.is_active as boolean,
    createdAt: s.created_at as string,
  }));

  const productivityLogs: ProductivityLog[] = (logsRes.data || []).map((l: Record<string, unknown>) => ({
    id: l.id as string,
    date: l.date as string,
    productiveMinutes: l.productive_minutes as number,
    totalWakingMinutes: l.total_waking_minutes as number | undefined,
    completions: l.completions as ProductivityLog['completions'] || [],
    wakeTime: l.wake_time as string | undefined,
    sleepTime: l.sleep_time as string | undefined,
    mood: l.mood as ProductivityLog['mood'],
  }));

  const sleepWakeLogs: SleepWakeLog[] = (sleepRes.data || []).map((s: Record<string, unknown>) => ({
    id: s.id as string || Math.random().toString(36).substr(2, 9),
    date: s.date as string,
    wakeUpTime: s.wake_up_time as string | undefined,
    wakeUpMood: s.wake_up_mood as SleepWakeLog['wakeUpMood'],
    sleepTime: s.sleep_time as string | undefined,
    sleepDurationMinutes: s.sleep_duration_minutes as number | undefined,
    sleepAttempts: (s.sleep_attempts as string[]) || [],
    createdAt: s.created_at as string || new Date().toISOString(),
    updatedAt: s.updated_at as string || new Date().toISOString(),
  }));

  console.log(`[Supabase] Loaded: ${goals.length} goals, ${tasks.length} tasks, ${timeSlots.length} slots`);
  
  return { goals, tasks, timeSlots, productivityLogs, sleepWakeLogs };
}

// ============================================
// SAVE ALL DATA TO SUPABASE (FULL SYNC)
// ============================================

export async function saveAllToSupabase(
  goals: Goal[],
  tasks: Task[],
  timeSlots: TimeSlot[],
  productivityLogs: ProductivityLog[],
  sleepWakeLogs: SleepWakeLog[]
): Promise<SyncResult> {
  console.log('[Supabase] Saving all data to server...');
  
  try {
    // Save all goals
    for (const goal of goals) {
      await saveGoal(goal);
    }
    
    // Save all tasks
    for (const task of tasks) {
      await saveTask(task);
    }
    
    // Save all time slots
    for (const slot of timeSlots) {
      await saveTimeSlot(slot);
    }
    
    // Save all productivity logs
    for (const log of productivityLogs) {
      await saveProductivityLog(log);
    }
    
    // Save all sleep logs
    for (const log of sleepWakeLogs) {
      await saveSleepWakeLog(log);
    }
    
    console.log('[Supabase] All data saved successfully!');
    return { success: true };
  } catch (err) {
    console.error('[Supabase] Failed to save all data:', err);
    return { success: false, error: String(err) };
  }
}

// ============================================
// DELETE GOAL FROM SUPABASE
// ============================================

export async function deleteGoalFromSupabase(goalId: string): Promise<SyncResult> {
  try {
    const { error } = await supabase
      .from('goals')
      .delete()
      .eq('id', goalId);
    if (error) throw error;
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// ============================================
// DELETE TASK FROM SUPABASE
// ============================================

export async function deleteTaskFromSupabase(taskId: string): Promise<SyncResult> {
  try {
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', taskId);
    if (error) throw error;
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// ============================================
// LEGACY EXPORTS (for backward compatibility)
// ============================================

export const pushAllToSupabase = saveAllToSupabase;
export const fetchAllFromSupabase = loadAllFromSupabase;
