import { NextRequest, NextResponse } from 'next/server';

// Ollama API endpoint (configurable via env)
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen2.5:7b';

interface ExtractionResult {
  mood?: number;
  energyLevel?: number;
  wins?: string[];
  challenges?: string[];
  productivityData?: Record<string, number>;
  summary?: string;
  suggestedGoals?: string[];
  suggestedTasks?: string[];
}

// POST /api/diary/extract - Extract structured data from free-form text
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text } = body;

    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    const systemPrompt = `You are an AI assistant that extracts structured data from daily journal entries.
Given a free-form journal entry, extract the following information:

1. mood: A number from 1-5 (1=very bad, 2=bad, 3=neutral, 4=good, 5=great)
2. energyLevel: A number from 1-10 (1=exhausted, 10=fully energized)
3. wins: An array of accomplishments or positive things that happened
4. challenges: An array of difficulties or blockers faced
5. productivityData: Object with time spent on categories (in minutes):
   - deep_work: focused productive work
   - shallow_work: emails, meetings prep, admin
   - meetings: time in meetings
   - exercise: physical activity
   - leisure: relaxation, entertainment
   - waste: unproductive time
6. summary: A 1-2 sentence summary of the day
7. suggestedGoals: Goals mentioned or implied that could be created
8. suggestedTasks: Specific tasks mentioned that could be tracked

Respond ONLY with a valid JSON object. Do not include any explanation or markdown formatting.
If information is not provided, omit that field from the response.`;

    const userPrompt = `Extract structured data from this journal entry:\n\n${text}`;

    // Call Ollama API
    let response;
    try {
      response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: OLLAMA_MODEL,
          prompt: userPrompt,
          system: systemPrompt,
          stream: false,
          options: {
            temperature: 0.3, // Lower temperature for more consistent extraction
            num_predict: 1024,
          },
        }),
      });
    } catch (fetchError) {
      // Ollama not available - return a basic fallback extraction
      console.log('[Extract] Ollama not available, using fallback extraction');
      return NextResponse.json({
        success: true,
        extraction: {
          mood: 3,      // Neutral mood as default
          energyLevel: 5, // Middle energy as default
          summary: text.slice(0, 200),
          wins: [],
          challenges: [],
        },
        fallback: true,
        message: 'LLM not available, using basic extraction. Edit the details manually.',
      });
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Ollama] API error:', errorText);
      // Return fallback instead of erroring
      return NextResponse.json({
        success: true,
        extraction: {
          mood: 3,
          energyLevel: 5,
          summary: text.slice(0, 200),
          wins: [],
          challenges: [],
        },
        fallback: true,
        message: 'LLM returned error, using basic extraction.',
      });
    }

    const ollamaResponse = await response.json();
    const rawOutput = ollamaResponse.response || '';

    // Try to parse the JSON response
    let extraction: ExtractionResult = {};
    try {
      // Clean up the response (remove markdown code blocks if present)
      let cleanedOutput = rawOutput.trim();
      if (cleanedOutput.startsWith('```json')) {
        cleanedOutput = cleanedOutput.slice(7);
      }
      if (cleanedOutput.startsWith('```')) {
        cleanedOutput = cleanedOutput.slice(3);
      }
      if (cleanedOutput.endsWith('```')) {
        cleanedOutput = cleanedOutput.slice(0, -3);
      }
      
      extraction = JSON.parse(cleanedOutput.trim());
    } catch (parseError) {
      console.error('[Ollama] Failed to parse response:', rawOutput);
      return NextResponse.json(
        { 
          error: 'Failed to parse LLM response', 
          rawOutput,
          details: parseError instanceof Error ? parseError.message : 'Unknown parse error'
        },
        { status: 500 }
      );
    }

    // Validate and sanitize the extracted data
    const validated: ExtractionResult = {};
    
    if (typeof extraction.mood === 'number' && extraction.mood >= 1 && extraction.mood <= 5) {
      validated.mood = Math.round(extraction.mood);
    }
    if (typeof extraction.energyLevel === 'number' && extraction.energyLevel >= 1 && extraction.energyLevel <= 10) {
      validated.energyLevel = Math.round(extraction.energyLevel);
    }
    if (Array.isArray(extraction.wins)) {
      validated.wins = extraction.wins.filter(w => typeof w === 'string').slice(0, 20);
    }
    if (Array.isArray(extraction.challenges)) {
      validated.challenges = extraction.challenges.filter(c => typeof c === 'string').slice(0, 20);
    }
    if (typeof extraction.productivityData === 'object' && extraction.productivityData !== null) {
      validated.productivityData = {};
      for (const [key, value] of Object.entries(extraction.productivityData)) {
        if (typeof value === 'number' && value >= 0) {
          validated.productivityData[key] = Math.round(value);
        }
      }
    }
    if (typeof extraction.summary === 'string') {
      validated.summary = extraction.summary.slice(0, 10000);
    }
    if (Array.isArray(extraction.suggestedGoals)) {
      validated.suggestedGoals = extraction.suggestedGoals.filter(g => typeof g === 'string').slice(0, 10);
    }
    if (Array.isArray(extraction.suggestedTasks)) {
      validated.suggestedTasks = extraction.suggestedTasks.filter(t => typeof t === 'string').slice(0, 10);
    }

    return NextResponse.json({
      success: true,
      extraction: validated,
      raw: rawOutput,
      model: OLLAMA_MODEL,
    });
  } catch (error) {
    console.error('[Extract API] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
