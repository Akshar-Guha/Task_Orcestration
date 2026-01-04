import { pipeline, env } from '@xenova/transformers';
import { createMemory as apiCreateMemory, searchMemories as apiSearchMemories } from './backend';

// Allow local models to be loaded if available, otherwise fetch from Hub
env.allowLocalModels = false;

let embeddingPipeline: any = null;

/**
 * Initialize the embedding pipeline
 */
export async function initEmbeddingPipeline() {
  if (!embeddingPipeline) {
    // We use gte-small because it's 384 dimensions (matches our DB schema)
    // and very lightweight (~30MB) for browsers/mobile.
    embeddingPipeline = await pipeline('feature-extraction', 'Supabase/gte-small');
  }
  return embeddingPipeline;
}

/**
 * Generate an embedding for a piece of text
 */
export async function getEmbedding(text: string): Promise<number[]> {
  const pipe = await initEmbeddingPipeline();
  const output = await pipe(text, { pooling: 'mean', normalize: true });
  return Array.from(output.data);
}

/**
 * Save a memory with a device-generated embedding
 */
export async function saveMemory(content: string, metadata: Record<string, unknown> = {}) {
  try {
    const embedding = await getEmbedding(content);
    return await apiCreateMemory(content, embedding, metadata);
  } catch (error) {
    console.error('Error saving memory:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Search memories using a device-generated query embedding
 */
export async function searchMemories(query: string) {
  try {
    const embedding = await getEmbedding(query);
    return await apiSearchMemories(embedding);
  } catch (error) {
    console.error('Error searching memories:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Save an achievement (goal/task completion) as a memory
 */
export async function saveAchievementMemory(
  title: string,
  description: string | undefined,
  metadata: { type: 'goal' | 'task'; id: string; timestamp: string }
) {
  const content = description 
    ? `Completed ${metadata.type}: ${title} - ${description}`
    : `Completed ${metadata.type}: ${title}`;
    
  return await saveMemory(content, {
    ...metadata,
    category: 'achievement'
  });
}
/**
 * Process pending memories (notes without embeddings from webhook)
 * Call this periodically to process webhook-ingested notes
 */
export async function processPendingMemories() {
  // Note: This function requires a backend endpoint to fetch memories with null embeddings
  // For now, this is a placeholder that can be implemented when needed
  // The webhook stores notes without embeddings, and they can be processed on-demand
  console.warn('processPendingMemories: Backend endpoint not yet implemented');
  return { success: false, error: 'Not implemented - requires backend endpoint' };
}
