// Database types matching Supabase schema
// These are the raw types from the database

export interface DbNode {
  id: string;
  user_id: string | null;
  type: 'goal' | 'task' | 'note' | 'routine' | 'milestone';
  title: string;
  description: string | null;
  status?: 'pending' | 'in_progress' | 'completed' | 'archived';
  recurrence_rule?: string | null; // RFC 5545 RRule format
  properties: Record<string, unknown>;
  metadata: Record<string, unknown>;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface DbEdge {
  id: string;
  source_id: string;
  target_id: string;
  relation_type: 'parent_of' | 'contributes_to' | 'blocked_by' | 'instance_of' | 'next_step';
  properties: Record<string, unknown>;
  user_id: string | null;
  created_at: string;
}

export interface DbMemory {
  id: string;
  node_id: string | null;
  user_id: string | null;
  content: string;
  embedding: number[] | null;
  created_at: string;
}

export interface DbDailyLog {
  id: string;
  user_id: string | null;
  log_date: string;
  metrics: Record<string, unknown>;
  created_at: string;
}

export interface DbProfile {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  timezone: string;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}
