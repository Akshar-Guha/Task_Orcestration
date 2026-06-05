import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getCurrentUserId } from '@/lib/user';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Ollama for summary generation
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen2.5:7b';

interface SummaryRequest {
  type: 'daily' | 'weekly' | 'monthly';
  date?: string;  // For daily
  weekStart?: string;  // For weekly
  monthStart?: string;  // For monthly
}

// POST /api/diary/summary - Generate AI summaries
export async function POST(request: NextRequest) {
  try {
    const userId = getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: 'User not configured' }, { status: 401 });
    }

    const body: SummaryRequest = await request.json();
    const { type } = body;

    let entries: Array<{
      date: string;
      mood: number | null;
      energy_level: number | null;
      summary: string | null;
      wins: string[] | null;
      challenges: string[] | null;
      productivity_data: Record<string, number>;
    }> = [];

    // Fetch entries based on summary type
    if (type === 'daily') {
      const date = body.date || new Date().toISOString().split('T')[0];
      const { data } = await supabase
        .from('daily_entries')
        .select('*')
        .eq('user_id', userId)
        .eq('date', date)
        .single();

      if (data) entries = [data];
    } else if (type === 'weekly') {
      const weekStart = body.weekStart || getWeekStart(new Date());
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);

      const { data } = await supabase
        .from('daily_entries')
        .select('*')
        .eq('user_id', userId)
        .gte('date', weekStart)
        .lte('date', weekEnd.toISOString().split('T')[0])
        .order('date', { ascending: true });

      entries = data || [];
    } else if (type === 'monthly') {
      const monthStart = body.monthStart || getMonthStart(new Date());
      const nextMonth = new Date(monthStart);
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      nextMonth.setDate(0); // Last day of month

      const { data } = await supabase
        .from('daily_entries')
        .select('*')
        .eq('user_id', userId)
        .gte('date', monthStart)
        .lte('date', nextMonth.toISOString().split('T')[0])
        .order('date', { ascending: true });

      entries = data || [];
    }

    if (entries.length === 0) {
      return NextResponse.json({ error: 'No entries found for this period' }, { status: 404 });
    }

    // Generate summary using LLM
    const summary = await generateSummary(entries, type);

    return NextResponse.json({
      summary,
      period: {
        type,
        entriesCount: entries.length,
        startDate: entries[0]?.date,
        endDate: entries[entries.length - 1]?.date,
      },
      stats: calculateStats(entries),
    });
  } catch (error) {
    console.error('[Summary API] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function generateSummary(
  entries: Array<{
    date: string;
    mood: number | null;
    energy_level: number | null;
    summary: string | null;
    wins: string[] | null;
    challenges: string[] | null;
    productivity_data: Record<string, number>;
  }>,
  type: 'daily' | 'weekly' | 'monthly'
): Promise<{ overview: string; insights: string[]; recommendations: string[] }> {
  const entrySummaries = entries.map((e) => ({
    date: e.date,
    mood: e.mood,
    energy: e.energy_level,
    summary: e.summary,
    wins: e.wins?.join(', ') || '',
    challenges: e.challenges?.join(', ') || '',
    deepWork: e.productivity_data?.deep_work || 0,
  }));

  const prompt = `Analyze these ${type} journal entries and provide:
1. A brief overview (2-3 sentences)
2. Key insights (3-4 bullet points)
3. Recommendations for improvement (2-3 actionable items)

Entries:
${JSON.stringify(entrySummaries, null, 2)}

Respond with ONLY a JSON object with fields: "overview" (string), "insights" (array of strings), "recommendations" (array of strings)`;

  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt,
        system: 'You are a helpful life coach analyzing journal entries. Be encouraging, specific, and actionable. Focus on patterns and growth opportunities.',
        stream: false,
        options: { temperature: 0.5, num_predict: 1024 },
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama error: ${response.status}`);
    }

    const data = await response.json();
    let parsed = { overview: '', insights: [] as string[], recommendations: [] as string[] };

    try {
      let cleanOutput = data.response.trim();
      if (cleanOutput.startsWith('```json')) cleanOutput = cleanOutput.slice(7);
      if (cleanOutput.startsWith('```')) cleanOutput = cleanOutput.slice(3);
      if (cleanOutput.endsWith('```')) cleanOutput = cleanOutput.slice(0, -3);
      parsed = JSON.parse(cleanOutput.trim());
    } catch {
      // Fallback to basic summary
      parsed.overview = `${type.charAt(0).toUpperCase() + type.slice(1)} summary: ${entries.length} entries recorded.`;
      parsed.insights = ['Keep up the journaling habit!'];
      parsed.recommendations = ['Continue tracking your mood and energy levels.'];
    }

    return parsed;
  } catch (error) {
    console.error('[Summary] LLM error:', error);
    return {
      overview: `You recorded ${entries.length} journal entries this ${type}.`,
      insights: [`Average mood: ${calculateStats(entries).avgMood.toFixed(1)}/5`],
      recommendations: ['Consider reviewing your entries to identify patterns.'],
    };
  }
}

function calculateStats(entries: Array<{
  mood: number | null;
  energy_level: number | null;
  wins: string[] | null;
  challenges: string[] | null;
  productivity_data: Record<string, number>;
}>) {
  const moods = entries.map((e) => e.mood).filter((m): m is number => m !== null);
  const energies = entries.map((e) => e.energy_level).filter((e): e is number => e !== null);
  
  const totalDeepWork = entries.reduce((sum, e) => sum + (e.productivity_data?.deep_work || 0), 0);
  const totalExercise = entries.reduce((sum, e) => sum + (e.productivity_data?.exercise || 0), 0);
  const totalWins = entries.reduce((sum, e) => sum + (e.wins?.length || 0), 0);
  const totalChallenges = entries.reduce((sum, e) => sum + (e.challenges?.length || 0), 0);

  return {
    avgMood: moods.length > 0 ? moods.reduce((a, b) => a + b, 0) / moods.length : 0,
    avgEnergy: energies.length > 0 ? energies.reduce((a, b) => a + b, 0) / energies.length : 0,
    totalDeepWork,
    totalExercise,
    totalWins,
    totalChallenges,
    entriesCount: entries.length,
  };
}

function getWeekStart(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().split('T')[0];
}

function getMonthStart(date: Date): string {
  const d = new Date(date);
  d.setDate(1);
  return d.toISOString().split('T')[0];
}
