import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getCurrentUserId } from '@/lib/user';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// GET /api/diary/questions - Get all active questions (system + user)
export async function GET(request: NextRequest) {
  try {
    const userId = getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: 'User not configured' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');

    let query = supabase
      .from('questions')
      .select('*')
      .or(`user_id.is.null,user_id.eq.${userId}`)
      .eq('active', true)
      .order('display_order', { ascending: true });

    if (category) {
      query = query.eq('category', category);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[Questions API] Error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const questions = (data || []).map((q) => ({
      id: q.id,
      userId: q.user_id,
      questionText: q.question_text,
      category: q.category,
      isAdaptive: q.is_adaptive,
      adaptiveRule: q.adaptive_rule,
      displayOrder: q.display_order,
      active: q.active,
      createdAt: q.created_at,
      updatedAt: q.updated_at,
    }));

    return NextResponse.json({ questions });
  } catch (error) {
    console.error('[Questions API] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/diary/questions - Create a new custom question
export async function POST(request: NextRequest) {
  try {
    const userId = getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: 'User not configured' }, { status: 401 });
    }

    const body = await request.json();
    const { questionText, category, isAdaptive, adaptiveRule, displayOrder } = body;

    if (!questionText || typeof questionText !== 'string') {
      return NextResponse.json({ error: 'Question text is required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('questions')
      .insert({
        user_id: userId,
        question_text: questionText,
        category: category || 'general',
        is_adaptive: isAdaptive || false,
        adaptive_rule: adaptiveRule || {},
        display_order: displayOrder || 0,
        active: true,
      })
      .select()
      .single();

    if (error) {
      console.error('[Questions API] Create error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      question: {
        id: data.id,
        userId: data.user_id,
        questionText: data.question_text,
        category: data.category,
        isAdaptive: data.is_adaptive,
        adaptiveRule: data.adaptive_rule,
        displayOrder: data.display_order,
        active: data.active,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      },
    }, { status: 201 });
  } catch (error) {
    console.error('[Questions API] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/diary/questions?id=uuid - Delete a custom question
export async function DELETE(request: NextRequest) {
  try {
    const userId = getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: 'User not configured' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const questionId = searchParams.get('id');

    if (!questionId) {
      return NextResponse.json({ error: 'Question ID is required' }, { status: 400 });
    }

    // Only allow deleting user's own questions (not system questions)
    const { error } = await supabase
      .from('questions')
      .delete()
      .eq('id', questionId)
      .eq('user_id', userId);

    if (error) {
      console.error('[Questions API] Delete error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Questions API] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
