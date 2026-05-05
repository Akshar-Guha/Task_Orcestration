import type { NextRequest } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';

const DEFAULT_TIMEZONE = 'UTC';

export function getRequestedTimeZone(request: NextRequest): string | null {
  const headerTimeZone = request.headers.get('x-user-timezone')?.trim();
  if (headerTimeZone) return headerTimeZone;

  const { searchParams } = new URL(request.url);
  const queryTimeZone = searchParams.get('timezone')?.trim();
  return queryTimeZone || null;
}

export async function resolveUserTimeZone(
  supabase: SupabaseClient,
  userId: string,
  request: NextRequest,
  requestedTimeZone?: string | null
): Promise<string> {
  const explicitTimeZone = requestedTimeZone ?? getRequestedTimeZone(request);
  if (explicitTimeZone) return explicitTimeZone;

  try {
    const { data } = await supabase
      .from('user_settings')
      .select('timezone')
      .eq('user_id', userId)
      .single();

    if (data?.timezone && typeof data.timezone === 'string') {
      return data.timezone;
    }
  } catch {
    // Fall back to UTC when user settings are unavailable.
  }

  return DEFAULT_TIMEZONE;
}

export function getDateInTimeZone(timeZone: string, date: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  return formatter.format(date);
}

export function clampPageSize(rawValue: string | null, defaultValue: number = 30, maxValue: number = 100): number {
  const parsed = Number.parseInt(rawValue ?? '', 10);
  if (Number.isNaN(parsed) || parsed <= 0) return defaultValue;
  return Math.min(parsed, maxValue);
}
