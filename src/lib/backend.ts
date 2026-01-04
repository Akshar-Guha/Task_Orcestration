// Backend API utilities for Edge Function calls

const EDGE_FUNCTION_URL = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/mto-router`;

export type BackendAction = 
  | 'test'
  | 'create_node'
  | 'update_node'
  | 'delete_node'
  | 'create_memory'
  | 'create_memory'
  | 'search_memories'
  | 'create_edge'
  | 'delete_edge'
  | 'get_nodes'
  | 'get_edges'
  | 'create_event'
  | 'get_events'
  | 'get_all';

export interface BackendResponse<T = unknown> {
  success: boolean;
  error?: string;
  node?: T;
  memory?: T;
  matches?: T[];
  edge?: T;
  nodes?: T[];
  edges?: T[];
  events?: T[];
  message?: string;
  timestamp?: string;
}

/**
 * Call the MTO backend Edge Function
 * @param action - The action to perform
 * @param data - Data payload for the action
 * @returns Response from the Edge Function
 */
export async function callBackend<T = unknown>(
  action: BackendAction,
  data: Record<string, unknown> = {}
): Promise<BackendResponse<T>> {
  try {
    const response = await fetch(EDGE_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action, data }),
    });

    const result = await response.json();
    return result;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Test backend connection
 */
export async function testBackendConnection(): Promise<boolean> {
  const result = await callBackend('test');
  return result.success;
}

/**
 * Create a new node
 */
export async function createNode(data: {
  id?: string;
  type: string;
  title: string;
  description?: string;
  properties?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  user_id?: string;
}) {
  return callBackend('create_node', data);
}

/**
 * Create a new memory
 */
export async function createMemory(content: string, embedding: number[], metadata: Record<string, unknown> = {}) {
  return callBackend('create_memory', { content, embedding, metadata });
}

/**
 * Create a new edge between nodes
 */
export async function createEdge(data: {
  source_id: string;
  target_id: string;
  relation_type?: 'parent_of' | 'contributes_to' | 'blocked_by' | 'instance_of' | 'next_step';
  properties?: Record<string, unknown>;
  user_id?: string;
}) {
  return callBackend('create_edge', data);
}

/**
 * Get all nodes
 */
export async function getNodes(filter?: { type?: string; is_archived?: boolean }) {
  return callBackend('get_nodes', filter || {});
}

/**
 * Get all edges
 */
export async function getEdges(filter?: { source_id?: string; target_id?: string }) {
  return callBackend('get_edges', filter || {});
}

/**
 * Get all nodes and edges in one call
 */
export async function getAllData() {
  return callBackend('get_all');
}

/**
 * Update a node
 */
export async function updateNode(id: string, updates: Record<string, unknown>) {
  return callBackend('update_node', { id, ...updates });
}

/**
 * Delete a node
 */
export async function deleteNode(id: string) {
  return callBackend('delete_node', { id });
}

/**
 * Delete an edge
 */
export async function deleteEdge(id: string) {
  return callBackend('delete_edge', { id });
}

// Timeline Events
export interface DbEvent {
  id: string;
  user_id?: string;
  event_type: string;
  goal_id?: string;
  task_id?: string;
  details: Record<string, unknown>;
  created_at: string;
}

/**
 * Log a timeline event
 */
export async function logEvent(data: {
  id?: string;
  event_type: string;
  goal_id?: string;
  task_id?: string;
  details?: Record<string, unknown>;
}) {
  return callBackend('create_event', data);
}

/**
 * Get timeline history
 */
export async function getEvents(limit: number = 50) {
  const result = await callBackend('get_events', { limit });
  if (result.success) {
    return { success: true, events: result.events as DbEvent[] };
  }
  return { success: false, error: result.error };
}



export async function searchMemories(query_embedding: number[]) {
  return callBackend('search_memories', { query_embedding });
}
