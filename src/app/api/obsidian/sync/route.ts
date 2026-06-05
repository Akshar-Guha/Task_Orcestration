/**
 * Obsidian Sync API Route
 *
 * Handles two request formats:
 * 1. Plugin format {file_path, file_name, content, user_id, modified_at}
 *    → upserts memories table with embedding (H9 fix)
 * 2. Web format {path, content, message, action}
 *    → proxies to GitHub
 */

import { NextResponse } from 'next/server';
import { github } from '@/lib/github';
import { createClient } from '@supabase/supabase-js';
import { generateEmbedding } from '@/lib/server-embedding';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Plugin format: from obsidian-mto-sync plugin
    if (body.file_path && body.user_id) {
      const { file_path, file_name, content, user_id, modified_at, tags } = body;

      if (!file_path || !content || !user_id) {
        return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
      }

      const { embedding, modelName } = await generateEmbedding(content);

      const { error } = await supabase.from('memories').upsert(
        {
          file_path,
          file_name: file_name || file_path.split('/').pop() || '',
          content,
          user_id,
          modified_at: modified_at || new Date().toISOString(),
          tags: tags || [],
          embedding,
          embedding_model: modelName,
        },
        { onConflict: 'file_path,user_id' }
      );

      if (error) {
        console.error('[Obsidian Sync] Memory upsert failed:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }

    // Web format: GitHub proxy
    const { path, content, message, action } = body;

    if (!path || !message) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    if (!github.isConfigured()) {
      return NextResponse.json({ success: false, error: 'GitHub not configured' }, { status: 503 });
    }

    if (action === 'delete') {
      const success = await github.softDeleteFile(path, message);
      return NextResponse.json({ success });
    }

    if (!content) {
      return NextResponse.json({ success: false, error: 'Missing content for upsert' }, { status: 400 });
    }

    const result = await github.upsertFile({ path, content }, message);
    return NextResponse.json({ success: !!result, data: result });

  } catch (error) {
    console.error('[API] Obsidian Sync Error:', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
