import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { BACKFILL_TYPES, appBaseUrl, exchangeCode, getConnectionByUser, redirectUri, requestBackfill, saveConnection } from '@/lib/garmin';

/** Garmin redirects here after the user approves access. */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const settingsUrl = `${appBaseUrl(request.url)}/settings/garmin`;
  const fail = (reason: string) =>
    NextResponse.redirect(`${settingsUrl}?error=${encodeURIComponent(reason)}`);

  if (params.get('error')) return fail(params.get('error') || 'denied');

  const code = params.get('code');
  const state = params.get('state');
  if (!code || !state) return fail('Missing code or state');

  const supabase = getSupabaseAdmin();
  const { data: stored } = await supabase
    .from('garmin_oauth_states')
    .select('*')
    .eq('state', state)
    .maybeSingle();
  // One-time use
  await supabase.from('garmin_oauth_states').delete().eq('state', state);

  if (!stored) return fail('Login session expired, please try again');
  if (Date.now() - new Date(stored.created_at).getTime() > 15 * 60 * 1000) {
    return fail('Login session expired, please try again');
  }

  try {
    const tokens = await exchangeCode(code, stored.code_verifier, redirectUri(request.url));
    await saveConnection(stored.user_id, tokens);

    // Pull in the last 30 days of history (delivered later via webhook)
    const conn = await getConnectionByUser(stored.user_id);
    if (conn) {
      await Promise.allSettled(BACKFILL_TYPES.map((t) => requestBackfill(conn, t, 30)));
    }
  } catch (e) {
    console.error('[Garmin] callback failed', e);
    return fail(e instanceof Error ? e.message : 'Token exchange failed');
  }

  return NextResponse.redirect(`${settingsUrl}?connected=1`);
}
