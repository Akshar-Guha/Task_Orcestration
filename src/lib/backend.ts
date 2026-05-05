import { supabase } from './supabase';

/**
 * Backend API for memory storage and retrieval via Supabase.
 */

export async function createMemory(
  content: string,
  embedding: number[],
  metadata: Record<string, unknown> = {}
) {
  const { data, error } = await supabase
    .from('memories')
    .insert({
      content,
      embedding,
      metadata,
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
  const { data, error } = await supabase
    .rpc('match_memories', {
      query_embedding: queryEmbedding,
      match_count: limit,
    });

  if (error) {
    console.error('[Backend] Failed to search memories:', error);
    return { success: false, error: error.message, results: [] };
  }

  return { success: true, results: data || [] };
}
