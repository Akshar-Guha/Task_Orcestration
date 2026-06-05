import { supabase } from './supabase';
import { getCurrentUserId } from './user';

/**
 * Backend API for memory storage and retrieval via Supabase.
 */

export async function createMemory(
  content: string,
  embedding: number[],
  metadata: Record<string, unknown> = {}
) {
  // BUG FIX: Include user_id so memories are scoped per user (matches db-types.ts DbMemory.user_id)
  const userId = getCurrentUserId();

  const { data, error } = await supabase
    .from('memories')
    .insert({
      content,
      embedding,
      metadata,
      user_id: userId || null,
      embedding_model: 'Supabase/gte-small',
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error('[Backend] Failed to create memory:', error);
    return { success: false, error: error.message };
  }

  return { success: true, data };
}

export async function searchMemories(
  queryEmbedding: number[],
  limit: number = 10
) {
  // BUG FIX: Pass user_id to the RPC so results are scoped to the current user
  const userId = getCurrentUserId();

  const { data, error } = await supabase
    .rpc('match_memories', {
      query_embedding: queryEmbedding,
      match_count: limit,
      filter_user_id: userId || null,
    });

  if (error) {
    console.error('[Backend] Failed to search memories:', error);
    return { success: false, error: error.message, results: [] };
  }

  return { success: true, results: data || [] };
}
