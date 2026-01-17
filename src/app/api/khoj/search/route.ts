/**
 * Khoj Search API Route
 * 
 * Server-side proxy to Khoj API.
 * IMPORTANT: This route must be in src/app/api/khoj/search/ for Next.js routing.
 */

import { NextRequest, NextResponse } from 'next/server';

const KHOJ_URL = process.env.KHOJ_URL || '';
const KHOJ_API_KEY = process.env.KHOJ_API_KEY || '';

export async function POST(req: NextRequest) {
  try {
    // Check configuration
    if (!KHOJ_URL) {
      return NextResponse.json(
        { error: 'Khoj not configured. Set KHOJ_URL environment variable.' },
        { status: 503 }
      );
    }

    const { query, limit = 10 } = await req.json();

    // Validate query
    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      );
    }

    if (query.length < 2) {
      return NextResponse.json(
        { error: 'Query must be at least 2 characters' },
        { status: 400 }
      );
    }

    // Call Khoj API
    const response = await fetch(`${KHOJ_URL}/api/search`, {
      method: 'POST',
      headers: {
        ...(KHOJ_API_KEY && { 'Authorization': `Bearer ${KHOJ_API_KEY}` }),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        q: query,
        n: Math.min(limit, 50), // Cap at 50 results
      }),
    });

    if (!response.ok) {
      console.error('[Khoj] API error:', response.status);
      return NextResponse.json(
        { error: 'Search service unavailable' },
        { status: 502 }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error('[Khoj Search] Error:', error);
    return NextResponse.json(
      { error: 'Search failed' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { 
      error: 'Method not allowed',
      usage: 'POST with { query: string, limit?: number }'
    },
    { status: 405 }
  );
}
