import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getCurrentUserId } from '@/lib/user';
import { createDailyEntrySchema, updateDailyEntrySchema } from '@/lib/diary-schemas';
import type { DailyEntryRow, DailyEntry } from '@/lib/diary-types';
import type { MoodLevel, EnergyLevel } from '@/lib/diary-types';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// GET /api/diary - List all diary entries for the user
// GET /api/diary?date=2026-01-17 - Get a specific entry by date
export async function GET(request: NextRequest) {
  try {
    const userId = getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: 'User not configured' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');
    const limit = parseInt(searchParams.get('limit') || '30');
    const offset = parseInt(searchParams.get('offset') || '0');

    let query = supabase
      .from('daily_entries')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false });

    if (date) {
      query = query.eq('date', date);
    } else {
      query = query.range(offset, offset + limit - 1);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[Diary API] Error fetching entries:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Convert snake_case to camelCase
    const entries: DailyEntry[] = (data || []).map((row: DailyEntryRow) => ({
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
    }));

    // If querying by date, return single entry or null
    if (date) {
      return NextResponse.json({ entry: entries[0] || null });
    }

    return NextResponse.json({ entries, total: entries.length });
  } catch (error) {
    console.error('[Diary API] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/diary - Create a new diary entry
export async function POST(request: NextRequest) {
  try {
    const userId = getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: 'User not configured' }, { status: 401 });
    }

    const body = await request.json();
    
    // Validate input
    const parseResult = createDailyEntrySchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const input = parseResult.data;

    // Check if entry already exists for this date
    const { data: existing } = await supabase
      .from('daily_entries')
      .select('id')
      .eq('user_id', userId)
      .eq('date', input.date)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: 'Entry already exists for this date', existingId: existing.id },
        { status: 409 }
      );
    }

    // Create the entry
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
      })
      .select()
      .single();

    if (error) {
      console.error('[Diary API] Error creating entry:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Convert to camelCase
    const entry: DailyEntry = {
      id: data.id,
      userId: data.user_id,
      date: data.date,
      mood: data.mood ?? undefined,
      energyLevel: data.energy_level ?? undefined,
      summary: data.summary ?? undefined,
      wins: data.wins ?? undefined,
      challenges: data.challenges ?? undefined,
      productivityData: data.productivity_data ?? {},
      customFields: data.custom_fields ?? undefined,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };

    return NextResponse.json({ entry }, { status: 201 });
  } catch (error) {
    console.error('[Diary API] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/diary - Update an existing diary entry
export async function PUT(request: NextRequest) {
  try {
    const userId = getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: 'User not configured' }, { status: 401 });
    }

    const body = await request.json();
    
    // Validate input
    const parseResult = updateDailyEntrySchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const { id, ...updates } = parseResult.data;

    // Build update object
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

    const { data, error } = await supabase
      .from('daily_entries')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', userId) // Ensure user owns this entry
      .select()
      .single();

    if (error) {
      console.error('[Diary API] Error updating entry:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
    }

    // Convert to camelCase
    const entry: DailyEntry = {
      id: data.id,
      userId: data.user_id,
      date: data.date,
      mood: data.mood ?? undefined,
      energyLevel: data.energy_level ?? undefined,
      summary: data.summary ?? undefined,
      wins: data.wins ?? undefined,
      challenges: data.challenges ?? undefined,
      productivityData: data.productivity_data ?? {},
      customFields: data.custom_fields ?? undefined,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };

    return NextResponse.json({ entry });
  } catch (error) {
    console.error('[Diary API] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/diary?id=uuid - Delete a diary entry
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

    const { error } = await supabase
      .from('daily_entries')
      .delete()
      .eq('id', id)
      .eq('user_id', userId); // Ensure user owns this entry

    if (error) {
      console.error('[Diary API] Error deleting entry:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Diary API] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
