/**
 * Synced Store Hook - Wraps Zustand store with Supabase sync
 * 
 * This hook provides the same interface as useAppStore but also
 * syncs changes to the Supabase backend via Edge Functions.
 * 
 * Usage:
 *   import { useSyncedStore } from '@/lib/useSyncedStore';
 *   const store = useSyncedStore();
 *   // Use exactly like useAppStore, but changes sync to Supabase
 */

'use client';

import { useCallback, useState } from 'react';
import { useAppStore } from './store';
import { syncGoal, syncTask, logTimelineEvent } from './sync';
import { saveAchievementMemory } from './memory';
import { updateNode, deleteNode, createEdge, deleteEdge, getAllData } from './backend';
import type { Goal, Task, TaskGoalLink } from './types';
import type { DbNode, DbEdge } from './db-types';
import { goalToNode, taskToNode, nodeToGoal, nodeToTask, edgeToLink } from './sync';

interface SyncState {
  isSyncing: boolean;
  lastSyncTime: string | null;
  syncError: string | null;
  pendingChanges: number;
}

export function useSyncedStore() {
  const store = useAppStore();
  const [syncState, setSyncState] = useState<SyncState>({
    isSyncing: false,
    lastSyncTime: null,
    syncError: null,
    pendingChanges: 0,
  });

  // ============================================
  // WRAPPED GOAL ACTIONS (with sync)
  // ============================================
  
  const addGoalWithSync = useCallback(
    async (input: Parameters<typeof store.addGoal>[0]) => {
      // First, add to local store (optimistic update)
      store.addGoal(input);
      
      // Then sync to backend
      setSyncState(s => ({ ...s, pendingChanges: s.pendingChanges + 1 }));
      
      // Get the newly created goal from store
      const goals = useAppStore.getState().goals;
      const newGoal = goals[goals.length - 1];
      
      if (newGoal) {
        const result = await syncGoal(newGoal);
        setSyncState(s => ({
          ...s,
          pendingChanges: s.pendingChanges - 1,
          lastSyncTime: result.success ? new Date().toISOString() : s.lastSyncTime,
          syncError: result.success ? null : result.error || 'Failed to sync goal',
        }));
      }
    },
    [store]
  );

  const updateGoalWithSync = useCallback(
    async (id: string, updates: Partial<Goal>) => {
      // Local update first
      store.updateGoal(id, updates);
      
      // Sync to backend
      const goal = useAppStore.getState().goals.find(g => g.id === id);
      if (goal) {
        const nodeData = goalToNode(goal);
        await updateNode(id, {
          title: nodeData.title,
          description: nodeData.description,
          properties: nodeData.properties,
          metadata: nodeData.metadata,
          is_archived: nodeData.is_archived,
        });
      }
    },
    [store]
  );

  const deleteGoalWithSync = useCallback(
    async (id: string) => {
      store.deleteGoal(id);
      await deleteNode(id);
    },
    [store]
  );

  // ============================================
  // WRAPPED TASK ACTIONS (with sync)
  // ============================================

  const addTaskWithSync = useCallback(
    async (input: Parameters<typeof store.addTask>[0]) => {
      const taskId = store.addTask(input);
      
      setSyncState(s => ({ ...s, pendingChanges: s.pendingChanges + 1 }));
      
      const task = useAppStore.getState().tasks.find(t => t.id === taskId);
      if (task) {
        const result = await syncTask(task);
        setSyncState(s => ({
          ...s,
          pendingChanges: s.pendingChanges - 1,
          lastSyncTime: result.success ? new Date().toISOString() : s.lastSyncTime,
          syncError: result.success ? null : result.error || 'Failed to sync task',
        }));
      }
      
      return taskId;
    },
    [store]
  );

  const completeTaskWithSync = useCallback(
    async (id: string) => {
      store.completeTask(id);
      
      const task = useAppStore.getState().tasks.find(t => t.id === id);
      if (task) {
        const nodeData = taskToNode(task);
        await updateNode(id, {
          properties: nodeData.properties,
        });
      }
    },
    [store]
  );

  const deleteTaskWithSync = useCallback(
    async (id: string) => {
      store.deleteTask(id);
      await deleteNode(id);
    },
    [store]
  );

  const completeGoalWithSync = useCallback(
    async (id: string) => {
      // Complete the goal locally
      store.completeGoal(id);
      
      // Get the completed goal for memory save
      const goal = useAppStore.getState().goals.find(g => g.id === id);
      if (goal) {
        // Save to memory system
        await saveAchievementMemory(
          goal.title,
          goal.description,
          {
            type: 'goal',
            id: goal.id,
            timestamp: goal.completedAt || new Date().toISOString()
          }
        );
        
        // Sync to backend
        const nodeData = goalToNode(goal);
        await updateNode(id, {
          properties: nodeData.properties,
        });
      }
    },
    [store]
  );


  // ============================================
  // WRAPPED LINK ACTIONS (with sync)
  // ============================================

  const linkTaskToGoalWithSync = useCallback(
    async (taskId: string, goalId: string, weight: number) => {
      store.linkTaskToGoal(taskId, goalId, weight);
      
      await createEdge({
        source_id: taskId,
        target_id: goalId,
        relation_type: 'contributes_to',
        properties: { contributionWeight: weight },
      });
    },
    [store]
  );

  const unlinkTaskWithSync = useCallback(
    async (linkId: string) => {
      store.unlinkTask(linkId);
      await deleteEdge(linkId);
    },
    [store]
  );

  // ============================================
  // WRAPPED TIMELINE ACTIONS (with sync)
  // ============================================

  const logTimelineEventWithSync = useCallback(
    async (eventType: Parameters<typeof store.logTimelineEvent>[0], goalId: string | undefined, taskId: string | undefined, details?: Record<string, unknown>) => {
      // Local log
      store.logTimelineEvent(eventType, goalId, taskId, details as any);

      // Sync to backend
      const event = useAppStore.getState().timelineEvents[0]; // Get the just-added event
      if (event) {
         await logTimelineEvent(event);
      }
    },
    [store]
  );

  // ============================================
  // SYNC UTILITIES
  // ============================================

  const loadFromCloud = useCallback(async () => {
    setSyncState(s => ({ ...s, isSyncing: true }));
    
    try {
      const result = await getAllData();
      
      if (result.success) {
        const nodes = (result.nodes || []) as DbNode[];
        const edges = (result.edges || []) as DbEdge[];
        
        // Convert and merge with local store
        const cloudGoals: Goal[] = [];
        const cloudTasks: Task[] = [];
        const cloudLinks: TaskGoalLink[] = [];
        
        for (const node of nodes) {
          if (node.type === 'goal') {
            const goal = nodeToGoal(node);
            if (goal) cloudGoals.push(goal);
          } else if (node.type === 'task') {
            const task = nodeToTask(node);
            if (task) cloudTasks.push(task);
          }
        }
        
        for (const edge of edges) {
          const link = edgeToLink(edge);
          if (link) cloudLinks.push(link);
        }
        
        // TODO: Merge strategy (currently just logs, doesn't overwrite)
        console.log('[Sync] Loaded from cloud:', { goals: cloudGoals.length, tasks: cloudTasks.length, links: cloudLinks.length });
        
        setSyncState(s => ({
          ...s,
          isSyncing: false,
          lastSyncTime: new Date().toISOString(),
          syncError: null,
        }));
        
        return { goals: cloudGoals, tasks: cloudTasks, links: cloudLinks };
      }
    } catch (error) {
      setSyncState(s => ({
        ...s,
        isSyncing: false,
        syncError: error instanceof Error ? error.message : 'Failed to load from cloud',
      }));
    }
    
    return null;
  }, []);

  // Return extended store with sync methods
  return {
    // Original store state and actions
    ...store,
    
    // Synced versions of actions
    addGoalWithSync,
    updateGoalWithSync,
    deleteGoalWithSync,
    addTaskWithSync,
    completeTaskWithSync,
    deleteTaskWithSync,
    completeGoalWithSync,
    linkTaskToGoalWithSync,
    unlinkTaskWithSync,
    logTimelineEventWithSync,
    
    // Sync utilities
    loadFromCloud,
    syncState,
  };
}

// Export type for consumers
export type SyncedStore = ReturnType<typeof useSyncedStore>;
