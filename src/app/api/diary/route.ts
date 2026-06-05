import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getCurrentUserId } from '@/lib/user';
import { createDailyEntrySchema, updateDailyEntrySchema } from '@/lib/diary-schemas';
import type { DailyEntryRow, DailyEntry } from '@/lib/diary-types';
import type { MoodLevel, EnergyLevel } from '@/lib/diary-types';
import { syncDiaryEntry } from '@/lib/obsidian-sync';
import { generateEmbedding, combineTextForEmbedding } from '@/lib/server-embedding';
import { clampPageSize, resolveUserTimeZone } from '@/lib/server-user-context';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function rowToEntry(row: DailyEntryRow): DailyEntry {
  return {
    id: row.id,
    userId: row.user_id,
    date: row.date,
    mood: row.mood as MoodLevel ?? undefined,
    energyLevel: row.energy_level as EnergyLevel ?? undefined,
    summary: row.summary ?? undefined,
    wins: row.wins ?? undefined,
    challenges: row.challenges ?? undefined,
    productivityData: row.productivity_data ?? {},
    customFields: row.custom_fields ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function GET(request: NextRequest) {
  try {
    const userId = getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: 'User not configured' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const limit = clampPageSize(searchParams.get('limit'));
    const cursor = searchParams.get('cursor');

    let query = supabase
      .from('daily_entries')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false });

    if (date) {
      query = query.eq('date', date).limit(10);
    } else if (startDate && endDate) {
      query = query.gte('date', startDate).lte('date', endDate);
    } else {
      if (cursor) query = query.lt('date', cursor);
      query = query.limit(limit + 1);
    }

    const { data, error } = await query;
    if (error) {
      console.error('[Diary API] Error fetching entries:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const rows = (data || []) as Array<DailyEntryRow & { user_timezone?: string | null }>;
    const entries = rows.map(rowToEntry);

    if (date) {
      const timezone = await resolveUserTimeZone(supabase, userId, request);
      const match = rows.find((row) => row.user_timezone === timezone || row.user_timezone == null);
      const entry = match ? rowToEntry(match) : entries[0] || null;
      return NextResponse.json({ entry });
    }

    const hasMore = !startDate && !endDate && entries.length > limit;
    const pagedEntries = hasMore ? entries.slice(0, limit) : entries;
    const nextCursor = hasMore ? pagedEntries[pagedEntries.length - 1]?.date ?? null : null;

    return NextResponse.json({
      entries: pagedEntries,
      total: pagedEntries.length,
      nextCursor,
      hasMore,
    });
  } catch (error) {
    console.error('[Diary API] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: 'User not configured' }, { status: 401 });
    }

    const body = await request.json();
    const parseResult = createDailyEntrySchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const input = parseResult.data;
    if (input.energyLevel !== undefined && (input.energyLevel < 1 || input.energyLevel > 10)) {
      return NextResponse.json({ error: 'energyLevel must be between 1 and 10' }, { status: 400 });
    }

    const userTimezone = await resolveUserTimeZone(supabase, userId, request, body.timezone);
    const { data: existingRows } = await supabase
      .from('daily_entries')
      .select('id,user_timezone')
      .eq('user_id', userId)
      .eq('date', input.date)
      .limit(10);

    const existing = (existingRows || []).find((row) => row.user_timezone === userTimezone || row.user_timezone == null);
    if (existing) {
      return NextResponse.json(
        { error: 'Entry already exists for this date', existingId: existing.id },
        { status: 409 }
      );
    }

    const embeddingText = combineTextForEmbedding({
      summary: input.summary,
      wins: input.wins,
      challenges: input.challenges,
    });
    const { embedding, modelName } = await generateEmbedding(embeddingText);
    const customExtractionModel =
      typeof input.customFields?.['extractionModel'] === 'string'
        ? input.customFields['extractionModel']
        : null;

    const { data, error } = await supabase
      .from('daily_entries')
      .insert({
        user_id: userId,
        date: input.date,
        mood: input.mood,
        energy_level: input.energyLevel,
        summary: input.summary,
        wins: input.wins,
        challenges: input.challenges,
        productivity_data: input.productivityData || {},
        custom_fields: input.customFields,
        embedding,
        embedding_model: modelName,
        extraction_model: body.extractionModel || customExtractionModel,
        user_timezone: userTimezone,
      })
      .select()
      .single();

    if (error) {
      console.error('[Diary API] Error creating entry:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const entry = rowToEntry(data as DailyEntryRow);
    syncDiaryEntry(entry).catch((err) =>
      console.error('[Diary API] Failed to sync new entry to Obsidian:', err)
    );

    return NextResponse.json({ entry }, { status: 201 });
  } catch (error) {
    console.error('[Diary API] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const userId = getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: 'User not configured' }, { status: 401 });
    }

    const body = await request.json();
    const parseResult = updateDailyEntrySchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const { id, ...updates } = parseResult.data;
    if (updates.energyLevel !== undefined && (updates.energyLevel < 1 || updates.energyLevel > 10)) {
      return NextResponse.json({ error: 'energyLevel must be between 1 and 10' }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (updates.date !== undefined) updateData.date = updates.date;
    if (updates.mood !== undefined) updateData.mood = updates.mood;
    if (updates.energyLevel !== undefined) updateData.energy_level = updates.energyLevel;
    if (updates.summary !== undefined) updateData.summary = updates.summary;
    if (updates.wins !== undefined) updateData.wins = updates.wins;
    if (updates.challenges !== undefined) updateData.challenges = updates.challenges;
    if (updates.productivityData !== undefined) updateData.productivity_data = updates.productivityData;
    if (updates.customFields !== undefined) updateData.custom_fields = updates.customFields;
    if (body.extractionModel !== undefined) updateData.extraction_model = body.extractionModel;

    const { data, error } = await supabase
      .from('daily_entries')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('[Diary API] Error updating entry:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
    }

    const entry = rowToEntry(data as DailyEntryRow);
    syncDiaryEntry(entry).catch((err) =>
      console.error('[Diary API] Failed to sync updated entry to Obsidian:', err)
    );

    return NextResponse.json({ entry });
  } catch (error) {
    console.error('[Diary API] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const userId = getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: 'User not configured' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Entry ID is required' }, { status: 400 });
    }

    const { data: entryData } = await supabase
      .from('daily_entries')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (!entryData) {
      return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
    }

    const { error } = await supabase
      .from('daily_entries')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      console.error('[Diary API] Error deleting entry:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (entryData) {
      const entry = rowToEntry(entryData as DailyEntryRow);
      syncDiaryEntry(entry, undefined, undefined, 'delete').catch((err) =>
        console.error('[Diary API] Failed to sync delete to Obsidian:', err)
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Diary API] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
