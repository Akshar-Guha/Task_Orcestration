import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getCurrentUserId } from '@/lib/user';

// Ollama API endpoint (configurable via env)
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen2.5:7b';
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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
    const { text, date } = body;

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
    } catch {
      // Ollama not available - use intelligent fallback extraction
      console.log('[Extract] Ollama not available, using pattern-based fallback extraction');
      
      const lowerText = text.toLowerCase();
      
      // Mood detection from keywords
      let detectedMood = 3;
      if (/great|amazing|awesome|fantastic|wonderful|excellent|happy|excited|joyful/i.test(lowerText)) {
        detectedMood = 5;
      } else if (/good|nice|well|fine|okay|productive|successful/i.test(lowerText)) {
        detectedMood = 4;
      } else if (/bad|terrible|awful|horrible|frustrated|stressed|angry|sad/i.test(lowerText)) {
        detectedMood = 1;
      } else if (/tired|exhausted|overwhelmed|struggling|difficult/i.test(lowerText)) {
        detectedMood = 2;
      }
      
      // Energy detection
      let detectedEnergy = 5;
      const energyMatch = lowerText.match(/energy\s*(?:level)?:?\s*(\d+)/i);
      if (energyMatch) {
        detectedEnergy = Math.min(10, Math.max(1, parseInt(energyMatch[1])));
      } else if (/exhausted|drained|no energy|very tired/i.test(lowerText)) {
        detectedEnergy = 2;
      } else if (/energized|full of energy|high energy/i.test(lowerText)) {
        detectedEnergy = 8;
      }
      
      // Extract wins - sentences with positive action words
      const wins: string[] = [];
      const winPatterns = /(?:completed|finished|accomplished|achieved|fixed|solved|deployed|launched|shipped|built|created)\s+[^.!?]+[.!?]/gi;
      let winMatch;
      while ((winMatch = winPatterns.exec(text)) !== null) {
        wins.push(winMatch[0].trim());
      }
      
      // Extract challenges - sentences with challenge words
      const challenges: string[] = [];
      const challengePatterns = /(?:struggled with|blocked by|couldn't|issue with|problem with|difficult to|failed to|stuck on)[^.!?]+[.!?]/gi;
      let challengeMatch;
      while ((challengeMatch = challengePatterns.exec(text)) !== null) {
        challenges.push(challengeMatch[0].trim());
      }
      
      // Extract time mentions for productivity
      const productivityData: Record<string, number> = {};
      const timePatterns = [
        { pattern: /(\d+)\s*(?:hours?|hrs?)\s*(?:of\s+)?(?:coding|programming|development|work)/gi, key: 'deep_work', multiplier: 60 },
        { pattern: /(\d+)\s*(?:minutes?|mins?)\s*(?:of\s+)?(?:coding|programming|development|work)/gi, key: 'deep_work', multiplier: 1 },
        { pattern: /(\d+)\s*(?:hours?|hrs?)\s*(?:of\s+)?(?:exercise|workout|running|gym)/gi, key: 'exercise', multiplier: 60 },
        { pattern: /(\d+)\s*(?:minutes?|mins?)\s*(?:of\s+)?(?:exercise|workout|running|gym)/gi, key: 'exercise', multiplier: 1 },
        { pattern: /(\d+)\s*(?:hours?|hrs?)\s*(?:of\s+)?(?:meeting|meetings|calls?)/gi, key: 'meetings', multiplier: 60 },
      ];
      
      for (const { pattern, key, multiplier } of timePatterns) {
        let match;
        while ((match = pattern.exec(text)) !== null) {
          productivityData[key] = (productivityData[key] || 0) + (parseInt(match[1]) * multiplier);
        }
      }
      
      return NextResponse.json({
        success: true,
        extraction: {
          mood: detectedMood,
          energyLevel: detectedEnergy,
          summary: text.slice(0, 300).trim() + (text.length > 300 ? '...' : ''),
          wins: wins.slice(0, 5),
          challenges: challenges.slice(0, 5),
          productivityData: Object.keys(productivityData).length > 0 ? productivityData : undefined,
        },
        fallback: true,
        message: 'LLM not available, used pattern-based extraction. Review and edit details.',
        model: 'pattern-fallback',
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
        model: 'basic-fallback',
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

    const userId = getCurrentUserId();
    let persistedGoals = 0;
    if (userId && Array.isArray(validated.suggestedGoals) && validated.suggestedGoals.length > 0) {
      const goalRows = validated.suggestedGoals.map((title) => ({
        user_id: userId,
        title,
        description: `Extracted from diary${date ? ` for ${date}` : ''}`,
        level: 'uncategorized',
        status: 'not_started',
        priority: 2,
        metadata: {
          source: 'diary_extract',
          extraction_model: OLLAMA_MODEL,
          extracted_at: new Date().toISOString(),
          date: date || null,
        },
        is_archived: false,
      }));

      const { data: insertedGoals } = await supabase
        .from('goals')
        .insert(goalRows)
        .select('id');

      persistedGoals = insertedGoals?.length || 0;
    }

    return NextResponse.json({
      success: true,
      extraction: validated,
      raw: rawOutput,
      model: OLLAMA_MODEL,
      persistedGoals,
    });
  } catch (error) {
    console.error('[Extract API] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
