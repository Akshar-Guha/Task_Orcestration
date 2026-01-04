/**
 * Sync Layer - Bridges Zustand store with Supabase database
 * 
 * Provides translation functions to convert between:
 * - Frontend types (Goal, Task, TaskGoalLink)
 * - Database types (DbNode, DbEdge)
 */

import type { Goal, Task, TaskGoalLink, GoalLevel, GoalMetadata, TimelineEvent } from './types';
import type { DbNode, DbEdge } from './db-types';
import { callBackend, logEvent } from './backend';
import { getCurrentUserId } from './user';

// ============================================
// TRANSLATION: Frontend → Database
// ============================================

/**
 * Convert a Goal to a DbNode
 */
export function goalToNode(goal: Goal): Partial<DbNode> {
  return {
    id: goal.id,
    type: 'goal',
    title: goal.title,
    description: goal.description || null,
    properties: {
      level: goal.level,
      status: goal.status,

      startedAt: goal.startedAt,
      completedAt: goal.completedAt,
      lastActivityAt: goal.lastActivityAt,
    },
    metadata: goal.metadata,
    is_archived: goal.isArchived,
    created_at: goal.createdAt,
  };
}

/**
 * Convert a Task to a DbNode
 */
export function taskToNode(task: Task): Partial<DbNode> {
  return {
    id: task.id,
    type: 'task',
    title: task.title,
    description: task.description || null,
    properties: {
      goalId: task.goalId,
      isRepeating: task.isRepeating,
      requiredCount: task.requiredCount,
      completedCount: task.completedCount,
      isCompleted: task.isCompleted,

      completedAt: task.completedAt,
    },
    metadata: {},
    is_archived: task.isArchived,
    created_at: task.createdAt,
  };
}

/**
 * Convert a TaskGoalLink to a DbEdge
 */
export function linkToEdge(link: TaskGoalLink): Partial<DbEdge> {
  return {
    id: link.id,
    source_id: link.taskId,
    target_id: link.goalId,
    relation_type: 'contributes_to',
    properties: {
      contributionWeight: link.contributionWeight,
    },
    created_at: link.createdAt,
  };
}

// ============================================
// TRANSLATION: Database → Frontend
// ============================================

/**
 * Convert a DbNode to a Goal (if type is 'goal')
 */
export function nodeToGoal(node: DbNode): Goal | null {
  if (node.type !== 'goal') return null;
  
  const properties = node.properties as Record<string, unknown>;
  const metadata = node.metadata as GoalMetadata;
  
  return {
    id: node.id,
    title: node.title,
    description: node.description || undefined,
    level: (properties.level as GoalLevel) || 'yearly',
    metadata: metadata || { type: 'yearly', year: new Date().getFullYear() },
    status: (properties.status as Goal['status']) || 'not_started',

    createdAt: node.created_at,
    startedAt: properties.startedAt as string | undefined,
    completedAt: properties.completedAt as string | undefined,
    lastActivityAt: properties.lastActivityAt as string | undefined,
    isArchived: node.is_archived,
  };
}

/**
 * Convert a DbNode to a Task (if type is 'task')
 */
export function nodeToTask(node: DbNode): Task | null {
  if (node.type !== 'task') return null;
  
  const properties = node.properties as Record<string, unknown>;
  
  return {
    id: node.id,
    title: node.title,
    description: node.description || undefined,
    goalId: properties.goalId as string | undefined,
    isRepeating: (properties.isRepeating as boolean) || false,
    requiredCount: (properties.requiredCount as number) || 1,
    completedCount: (properties.completedCount as number) || 0,
    isCompleted: (properties.isCompleted as boolean) || false,

    createdAt: node.created_at,
    completedAt: properties.completedAt as string | undefined,
    isArchived: node.is_archived,
  };
}

/**
 * Convert a DbEdge to a TaskGoalLink (if relation_type is 'contributes_to')
 */
export function edgeToLink(edge: DbEdge): TaskGoalLink | null {
  if (edge.relation_type !== 'contributes_to') return null;
  
  const properties = edge.properties as Record<string, unknown>;
  
  return {
    id: edge.id,
    taskId: edge.source_id,
    goalId: edge.target_id,
    contributionWeight: (properties.contributionWeight as number) || 50,
    createdAt: edge.created_at,
  };
}

// ============================================
// SYNC OPERATIONS
// ============================================

/**
 * Sync a Goal to the database
 */
export async function syncGoal(goal: Goal): Promise<{ success: boolean; error?: string }> {
  // Pass local UUID to backend to ensure ID match
  const result = await callBackend('create_node', {
    id: goal.id, // Explicitly pass ID
    type: 'goal',
    title: goal.title,
    description: goal.description || '',
    properties: {
      level: goal.level,
      status: goal.status,
    },
    metadata: goal.metadata,
    user_id: getCurrentUserId(),
  });
  return result;
}

/**
 * Sync a Task to the database
 */
export async function syncTask(task: Task): Promise<{ success: boolean; error?: string }> {
  // Pass local UUID to backend to ensure ID match
  const result = await callBackend('create_node', {
    id: task.id, // Explicitly pass ID
    type: 'task',
    title: task.title,
    description: task.description || '',
    properties: {
      goalId: task.goalId,
      isRepeating: task.isRepeating,
      requiredCount: task.requiredCount,
      completedCount: task.completedCount,
      isCompleted: task.isCompleted,

      completedAt: task.completedAt,
    },
    metadata: {},
    user_id: getCurrentUserId(),
  });
  return result;
}

/**
 * Sync a Link to the database
 */
export async function syncLink(link: TaskGoalLink): Promise<{ success: boolean; error?: string }> {
  const edgeData = linkToEdge(link);
  const result = await callBackend('create_edge', {
    id: edgeData.id, // Explicitly pass ID
    source_id: edgeData.source_id,
    target_id: edgeData.target_id,
    relation_type: edgeData.relation_type,
    properties: edgeData.properties,
  });
  return result;
}

/**
 * Fetch all data from database and convert to frontend types
 */
export async function fetchAllData(): Promise<{
  goals: Goal[];
  tasks: Task[];
  links: TaskGoalLink[];
}> {
  const result = await callBackend('get_nodes');
  
  if (!result.success || !result.nodes) {
    return { goals: [], tasks: [], links: [] };
  }
  
  const nodes = result.nodes as DbNode[];
  const goals: Goal[] = [];
  const tasks: Task[] = [];
  
  for (const node of nodes) {
    if (node.type === 'goal') {
      const goal = nodeToGoal(node);
      if (goal) goals.push(goal);
    } else if (node.type === 'task') {
      const task = nodeToTask(node);
      if (task) tasks.push(task);
    }
  }
  
  // TODO: Fetch edges when endpoint is available
  const links: TaskGoalLink[] = [];
  
  return { goals, tasks, links };
}

// Timeline Sync
export async function logTimelineEvent(event: TimelineEvent) {
  return logEvent({
    id: event.id,
    event_type: event.eventType,
    goal_id: event.goalId,
    task_id: event.taskId,
    details: (event.details || {}) as Record<string, unknown>,
  });
}
