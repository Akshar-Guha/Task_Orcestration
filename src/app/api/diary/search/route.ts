import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getCurrentUserId } from '@/lib/user';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Ollama embedding endpoint
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const EMBEDDING_MODEL = process.env.OLLAMA_EMBEDDING_MODEL || 'nomic-embed-text';

interface SearchResult {
  id: string;
  date: string;
  summary: string | null;
  mood: number | null;
  similarity: number;
}

// Generate embedding using Ollama
async function generateEmbedding(text: string): Promise<number[] | null> {
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        prompt: text,
      }),
    });

    if (!response.ok) {
      console.error('[Embedding] Ollama error:', response.status);
      return null;
    }

    const data = await response.json();
    return data.embedding;
  } catch (error) {
    console.error('[Embedding] Failed to generate:', error);
    return null;
  }
}

// POST /api/diary/search - Semantic search across diary entries
export async function POST(request: NextRequest) {
  try {
    const userId = getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: 'User not configured' }, { status: 401 });
    }

    const body = await request.json();
    const { query, threshold = 0.7, limit = 10 } = body;

    if (!query || typeof query !== 'string') {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    // Generate embedding for the query
    const embedding = await generateEmbedding(query);
    
    if (!embedding) {
      // Fallback to text search if embedding fails
      const { data, error } = await supabase
        .from('daily_entries')
        .select('id, date, summary, mood')
        .eq('user_id', userId)
        .or(`summary.ilike.%${query}%,wins.cs.{${query}},challenges.cs.{${query}}`)
        .order('date', { ascending: false })
        .limit(limit);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({
        results: data || [],
        method: 'text_search',
        message: 'Semantic search unavailable, using text search',
      });
    }

    // Use pgvector semantic search
    const { data, error } = await supabase.rpc('search_diary_entries', {
      query_embedding: embedding,
      match_threshold: threshold,
      match_count: limit,
      p_user_id: userId,
    });

    if (error) {
      console.error('[Search] RPC error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const results: SearchResult[] = (data || []).map((r: SearchResult) => ({
      id: r.id,
      date: r.date,
      summary: r.summary,
      mood: r.mood,
      similarity: r.similarity,
    }));

    return NextResponse.json({
      results,
      method: 'semantic_search',
      embedding_model: EMBEDDING_MODEL,
    });
  } catch (error) {
    console.error('[Search API] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/diary/search - Update embeddings for entries (batch job)
export async function PUT(request: NextRequest) {
  try {
    const userId = getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: 'User not configured' }, { status: 401 });
    }

    const body = await request.json();
    const { entryIds, reindexAll = false } = body;

    let query = supabase
      .from('daily_entries')
      .select('id, summary, wins, challenges')
      .eq('user_id', userId);

    if (!reindexAll && entryIds && Array.isArray(entryIds)) {
      query = query.in('id', entryIds);
    } else if (!reindexAll) {
      // Only index entries without embeddings
      query = query.is('embedding', null);
    }

    const { data: entries, error } = await query.limit(50);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    let indexed = 0;
    let failed = 0;

    for (const entry of entries || []) {
      // Combine text for embedding
      const text = [
        entry.summary,
        ...(entry.wins || []),
        ...(entry.challenges || []),
      ].filter(Boolean).join(' ');

      if (!text.trim()) {
        failed++;
        continue;
      }

      const embedding = await generateEmbedding(text);
      if (!embedding) {
        failed++;
        continue;
      }

      const { error: updateError } = await supabase
        .from('daily_entries')
        .update({ embedding })
        .eq('id', entry.id);

      if (updateError) {
        console.error('[Embedding] Update error:', updateError);
        failed++;
      } else {
        indexed++;
      }

      // Rate limit to avoid overwhelming Ollama
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    return NextResponse.json({
      success: true,
      indexed,
      failed,
      total: (entries || []).length,
    });
  } catch (error) {
    console.error('[Search API] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
