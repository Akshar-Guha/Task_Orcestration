/**
 * Obsidian Sync API Route
 * 
 * Secure proxy for GitHub API operations.
 * Handles upsert and delete operations for Obsidian vault.
 */

import { NextResponse } from 'next/server';
import { github } from '@/lib/github';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { path, content, message, action } = body;

    if (!path || !message) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (!github.isConfigured()) {
      return NextResponse.json(
        { success: false, error: 'GitHub not configured' },
        { status: 503 }
      );
    }

    if (action === 'delete') {
      const success = await github.softDeleteFile(path, message);
      return NextResponse.json({ success });
    }

    // Default upsert
    if (!content) {
      return NextResponse.json(
        { success: false, error: 'Missing content for upsert' },
        { status: 400 }
      );
    }
    
    const result = await github.upsertFile({ path, content }, message);
    return NextResponse.json({ success: !!result, data: result });

  } catch (error) {
    console.error('[API] Obsidian Sync Error:', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
