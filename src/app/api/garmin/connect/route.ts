import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getCurrentUserId } from '@/lib/user';
import {
  GARMIN_AUTHORIZE_URL,
  createPkcePair,
  garminConfig,
  isPinValid,
  redirectUri,
} from '@/lib/garmin';

/**
 * POST { pin } → { url }
 * Starts the Garmin OAuth 2.0 PKCE flow. The browser then navigates to `url`.
 */
export async function POST(request: NextRequest) {
  const { pin } = await request.json().catch(() => ({ pin: null }));
  if (!isPinValid(pin)) return NextResponse.json({ error: 'Invalid PIN' }, { status: 401 });

  const { clientId, configured } = garminConfig();
  if (!configured || !clientId) {
    return NextResponse.json(
      { error: 'GARMIN_CLIENT_ID / GARMIN_CLIENT_SECRET are not set in Vercel' },
      { status: 500 }
    );
  }

  const userId = getCurrentUserId();
  if (!userId) return NextResponse.json({ error: 'User not configured' }, { status: 500 });

  const { codeVerifier, codeChallenge, state } = createPkcePair();
  const supabase = getSupabaseAdmin();

  // Clear stale states (older than 15 minutes), then store this one
  await supabase
    .from('garmin_oauth_states')
    .delete()
    .lt('created_at', new Date(Date.now() - 15 * 60 * 1000).toISOString());
  const { error } = await supabase
    .from('garmin_oauth_states')
    .insert({ state, user_id: userId, code_verifier: codeVerifier });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const url = new URL(GARMIN_AUTHORIZE_URL);
  url.search = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    redirect_uri: redirectUri(request.url),
    state,
  }).toString();

  return NextResponse.json({ url: url.toString() });
}
