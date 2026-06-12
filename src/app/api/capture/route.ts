import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getCurrentUserId } from '@/lib/user';
import { getDateInTimeZone, resolveUserTimeZone } from '@/lib/server-user-context';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface CaptureExtraction {
  mood?: number;
  energyLevel?: number;
  wins?: string[];
  challenges?: string[];
  summary?: string;
  productivityData?: Record<string, number>;
  suggestedTasks?: string[];
  suggestedGoals?: string[];
}

interface CaptureBody {
  text?: string;
  extracted?: CaptureExtraction;
  source?: string;
  timezone?: string;
}

// POST /api/capture - One Inbox: unified capture entry point.
// Two payload shapes:
//   { extracted: {...} }  - pre-structured by the on-device SLM Shortcut (preferred)
//   { text: "..." }       - raw text; extracted server-side via /api/diary/extract
//     (local Ollama with pattern fallback - no external AI APIs at capture time)
export async function POST(request: NextRequest) {
  const secret = process.env.CAPTURE_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'CAPTURE_SECRET not configured' }, { status: 500 });
  }
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: 'User not configured' }, { status: 401 });
  }

  let body: CaptureBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const text = typeof body.text === 'string' ? body.text.trim() : '';
  let extracted = body.extracted;

  if (!extracted && !text) {
    return NextResponse.json({ error: 'Provide either text or extracted' }, { status: 400 });
  }

  // Raw-text path: extract server-side (local Ollama / pattern fallback).
  // If both text and extracted are sent, explicit extracted fields win over extraction.
  if (text) {
    let fromText: CaptureExtraction = { summary: text };
    try {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      const res = await fetch(`${appUrl}/api/diary/extract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (res.ok && data.extraction) fromText = data.extraction;
    } catch {
      // keep raw text as summary
    }
    extracted = { ...fromText, ...extracted };
  }

  if (extracted!.mood !== undefined && (extracted!.mood < 1 || extracted!.mood > 5)) {
    return NextResponse.json({ error: 'mood must be between 1 and 5' }, { status: 400 });
  }
  if (extracted!.energyLevel !== undefined && (extracted!.energyLevel < 1 || extracted!.energyLevel > 10)) {
    return NextResponse.json({ error: 'energyLevel must be between 1 and 10' }, { status: 400 });
  }

  try {
    const timezone = await resolveUserTimeZone(supabase, userId, request, body.timezone);
    const today = getDateInTimeZone(timezone);

    const wins = (extracted!.wins || []).map((w) => w.trim()).filter(Boolean);
    const challenges = (extracted!.challenges || []).map((c) => c.trim()).filter(Boolean);
    const summary = extracted!.summary?.trim();

    const { data: existing } = await supabase
      .from('daily_entries')
      .select('id, wins, challenges, summary')
      .eq('user_id', userId)
      .eq('date', today)
      .single();

    let entryAction: 'created' | 'updated';
    if (existing) {
      const update: Record<string, unknown> = {
        wins: [...(existing.wins || []), ...wins],
        challenges: [...(existing.challenges || []), ...challenges],
        updated_at: new Date().toISOString(),
      };
      if (extracted!.mood !== undefined) update.mood = extracted!.mood;
      if (extracted!.energyLevel !== undefined) update.energy_level = extracted!.energyLevel;
      if (summary) {
        update.summary = existing.summary ? `${existing.summary}\n${summary}` : summary;
      }
      const { error } = await supabase
        .from('daily_entries')
        .update(update)
        .eq('id', existing.id)
        .eq('user_id', userId);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      entryAction = 'updated';
    } else {
      const { error } = await supabase.from('daily_entries').insert({
        user_id: userId,
        date: today,
        mood: extracted!.mood ?? null,
        energy_level: extracted!.energyLevel ?? null,
        summary: summary ?? null,
        wins,
        challenges,
        productivity_data: extracted!.productivityData || {},
        user_timezone: timezone,
      });
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      entryAction = 'created';
    }

    // Extracted tasks land in the tracker automatically
    const taskTitles = (extracted!.suggestedTasks || []).map((t) => t.trim()).filter(Boolean);
    let tasksCreated = 0;
    if (taskTitles.length > 0) {
      const { data: inserted, error } = await supabase
        .from('tasks')
        .insert(taskTitles.map((title) => ({ user_id: userId, title })))
        .select('id');
      if (error) {
        console.error('[Capture] Task insert failed:', error.message);
      } else {
        tasksCreated = inserted?.length || 0;
      }
    }

    return NextResponse.json({
      success: true,
      date: today,
      entry: entryAction,
      tasksCreated,
      // Goals are suggestions only - confirmed by the user in the app, never auto-created
      suggestedGoals: extracted!.suggestedGoals || [],
    });
  } catch (error) {
    console.error('[Capture] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
