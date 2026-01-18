/**
 * Server-side embedding generation for API routes
 * Uses Supabase Edge Function or external API for embeddings
 * 
 * Since @xenova/transformers requires browser environment,
 * API routes use this server-side alternative.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

interface EmbeddingResult {
  success: boolean;
  embedding?: number[];
  error?: string;
}

/**
 * Generate embedding for text using the mto-router Edge Function
 * Falls back to null if embedding generation fails (non-blocking)
 */
export async function generateEmbedding(text: string): Promise<number[] | null> {
  try {
    // Use the Supabase Edge Function that has access to the embedding model
    const response = await fetch(`${SUPABASE_URL}/functions/v1/mto-router`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        action: 'generate_embedding',
        data: { text }
      }),
    });

    if (!response.ok) {
      console.warn('[Embedding] Edge function returned error:', response.status);
      return null;
    }

    const result: EmbeddingResult = await response.json();
    
    if (result.success && result.embedding) {
      return result.embedding;
    }
    
    console.warn('[Embedding] Failed to generate:', result.error);
    return null;
  } catch (error) {
    console.warn('[Embedding] Error generating embedding:', error);
    return null;
  }
}

/**
 * Combine multiple text fields into a single embeddable text
 */
export function combineTextForEmbedding(fields: {
  summary?: string;
  wins?: string[];
  challenges?: string[];
  title?: string;
  description?: string;
}): string {
  const parts: string[] = [];
  
  if (fields.title) parts.push(fields.title);
  if (fields.summary) parts.push(fields.summary);
  if (fields.description) parts.push(fields.description);
  if (fields.wins?.length) parts.push(`Wins: ${fields.wins.join(', ')}`);
  if (fields.challenges?.length) parts.push(`Challenges: ${fields.challenges.join(', ')}`);
  
  return parts.join(' ');
}
