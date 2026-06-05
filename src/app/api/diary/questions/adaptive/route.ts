import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getCurrentUserId } from '@/lib/user';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Ollama for question generation
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen2.5:7b';

interface AdaptiveContext {
  recentMoods: number[];
  recentChallenges: string[];
  recentWins: string[];
  currentStreak: number;
  goalsInProgress: string[];
  dayOfWeek: number;
  timeOfDay: 'morning' | 'afternoon' | 'evening';
}

interface Question {
  id: string;
  questionText: string;
  category: string;
  isAdaptive: boolean;
  source: 'system' | 'generated' | 'user';
}

// POST /api/diary/questions/adaptive - Generate adaptive questions based on context
export async function POST(request: NextRequest) {
  try {
    const userId = getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: 'User not configured' }, { status: 401 });
    }

    const body = await request.json();
    const { currentEntry, includeSystemQuestions = true } = body;

    // Gather context from recent entries
    const context = await gatherContext(userId);

    // Get system questions (always include some base questions)
    let questions: Question[] = [];

    if (includeSystemQuestions) {
      const { data: systemQuestions } = await supabase
        .from('questions')
        .select('*')
        .is('user_id', null)
        .eq('active', true)
        .order('display_order', { ascending: true })
        .limit(3);

      questions = (systemQuestions || []).map((q) => ({
        id: q.id,
        questionText: q.question_text,
        category: q.category,
        isAdaptive: false,
        source: 'system' as const,
      }));
    }

    // Generate adaptive questions using LLM
    const adaptiveQuestions = await generateAdaptiveQuestions(context, currentEntry);
    questions = [...questions, ...adaptiveQuestions];

    // Apply rule-based adaptive questions
    const ruleBasedQuestions = applyRules(context, currentEntry);
    questions = [...questions, ...ruleBasedQuestions];

    // Deduplicate and limit
    const uniqueQuestions = deduplicateQuestions(questions);

    return NextResponse.json({
      questions: uniqueQuestions.slice(0, 8),
      context: {
        streak: context.currentStreak,
        recentMoodAvg: context.recentMoods.length > 0 
          ? (context.recentMoods.reduce((a, b) => a + b, 0) / context.recentMoods.length).toFixed(1)
          : null,
        goalsInProgress: context.goalsInProgress.length,
      },
    });
  } catch (error) {
    console.error('[Adaptive Questions API] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function gatherContext(userId: string): Promise<AdaptiveContext> {
  // Get recent entries (last 7 days)
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const { data: recentEntries } = await supabase
    .from('daily_entries')
    .select('mood, wins, challenges, date')
    .eq('user_id', userId)
    .gte('date', weekAgo.toISOString().split('T')[0])
    .order('date', { ascending: false })
    .limit(7);

  // Get streak
  const { data: streakData } = await supabase.rpc('calculate_diary_streak', { p_user_id: userId });
  const currentStreak = streakData?.[0]?.current_streak || 0;

  // Get active goals
  const { data: goals } = await supabase
    .from('goals')
    .select('title')
    .eq('user_id', userId)
    .eq('status', 'in_progress')
    .limit(5);

  const now = new Date();
  const hour = now.getHours();
  const timeOfDay = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';

  return {
    recentMoods: (recentEntries || []).map((e) => e.mood).filter(Boolean) as number[],
    recentChallenges: (recentEntries || []).flatMap((e) => e.challenges || []).slice(0, 5),
    recentWins: (recentEntries || []).flatMap((e) => e.wins || []).slice(0, 5),
    currentStreak,
    goalsInProgress: (goals || []).map((g) => g.title),
    dayOfWeek: now.getDay(),
    timeOfDay,
  };
}

async function generateAdaptiveQuestions(
  context: AdaptiveContext,
  currentEntry?: { summary?: string; mood?: number }
): Promise<Question[]> {
  try {
    const prompt = buildQuestionPrompt(context, currentEntry);

    const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt,
        system: `You are a thoughtful journaling coach. Generate 2-3 personalized follow-up questions based on the user's context. 
Each question should be:
- Open-ended and reflective
- Specific to their situation
- Encouraging and non-judgmental

Respond with ONLY a JSON array of objects with "questionText" and "category" fields.
Categories: reflection, planning, gratitude, growth, habits`,
        stream: false,
        options: { temperature: 0.7, num_predict: 512 },
      }),
    });

    if (!response.ok) {
      console.error('[Adaptive] Ollama error:', response.status);
      return [];
    }

    const data = await response.json();
    let parsed: Array<{ questionText: string; category: string }> = [];

    try {
      let cleanOutput = data.response.trim();
      if (cleanOutput.startsWith('```json')) cleanOutput = cleanOutput.slice(7);
      if (cleanOutput.startsWith('```')) cleanOutput = cleanOutput.slice(3);
      if (cleanOutput.endsWith('```')) cleanOutput = cleanOutput.slice(0, -3);
      parsed = JSON.parse(cleanOutput.trim());
    } catch {
      console.error('[Adaptive] Parse error');
      return [];
    }

    return parsed.slice(0, 3).map((q, i) => ({
      id: `adaptive-${Date.now()}-${i}`,
      questionText: q.questionText,
      category: q.category || 'reflection',
      isAdaptive: true,
      source: 'generated' as const,
    }));
  } catch (error) {
    console.error('[Adaptive] Generation error:', error);
    return [];
  }
}

function buildQuestionPrompt(
  context: AdaptiveContext,
  currentEntry?: { summary?: string; mood?: number }
): string {
  const parts: string[] = [];

  if (currentEntry?.summary) {
    parts.push(`Today's entry summary: "${currentEntry.summary}"`);
  }

  if (currentEntry?.mood) {
    const moodText = ['very low', 'low', 'neutral', 'good', 'great'][currentEntry.mood - 1];
    parts.push(`Current mood: ${moodText} (${currentEntry.mood}/5)`);
  }

  if (context.currentStreak > 0) {
    parts.push(`Current journaling streak: ${context.currentStreak} days`);
  }

  if (context.recentChallenges.length > 0) {
    parts.push(`Recent challenges mentioned: ${context.recentChallenges.slice(0, 3).join(', ')}`);
  }

  if (context.goalsInProgress.length > 0) {
    parts.push(`Active goals: ${context.goalsInProgress.join(', ')}`);
  }

  parts.push(`Time: ${context.timeOfDay}, ${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][context.dayOfWeek]}`);

  return `Generate personalized journaling questions for this context:\n\n${parts.join('\n')}`;
}

function applyRules(
  context: AdaptiveContext,
  currentEntry?: { summary?: string; mood?: number }
): Question[] {
  const questions: Question[] = [];

  // Low mood rule
  if (currentEntry?.mood && currentEntry.mood <= 2) {
    questions.push({
      id: 'rule-low-mood',
      questionText: 'What would help you feel even slightly better right now?',
      category: 'support',
      isAdaptive: true,
      source: 'system',
    });
  }

  // High streak rule (celebration)
  if (context.currentStreak >= 7 && context.currentStreak % 7 === 0) {
    questions.push({
      id: 'rule-streak-milestone',
      questionText: `Congratulations on ${context.currentStreak} days! What has helped you maintain this habit?`,
      category: 'reflection',
      isAdaptive: true,
      source: 'system',
    });
  }

  // Weekend planning
  if (context.dayOfWeek === 5 && context.timeOfDay === 'evening') {
    questions.push({
      id: 'rule-weekend-prep',
      questionText: 'What would make this weekend feel restorative?',
      category: 'planning',
      isAdaptive: true,
      source: 'system',
    });
  }

  // Monday motivation
  if (context.dayOfWeek === 1 && context.timeOfDay === 'morning') {
    questions.push({
      id: 'rule-monday-focus',
      questionText: 'What is the ONE thing you want to accomplish this week?',
      category: 'planning',
      isAdaptive: true,
      source: 'system',
    });
  }

  return questions;
}

function deduplicateQuestions(questions: Question[]): Question[] {
  const seen = new Set<string>();
  return questions.filter((q) => {
    const key = q.questionText.toLowerCase().slice(0, 50);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
