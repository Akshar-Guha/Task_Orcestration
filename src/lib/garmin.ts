/**
 * Garmin Connect Developer Program — Health API helpers (server only).
 *
 * Auth: OAuth 2.0 with PKCE (S256).
 * Data: Garmin pushes summaries to our webhook (/api/garmin/webhook) whenever
 *       the watch syncs. In "ping" mode it sends a callbackURL we fetch instead.
 *
 * Required env vars (set in Vercel):
 *   GARMIN_CLIENT_ID, GARMIN_CLIENT_SECRET   – from the Garmin developer portal
 *   NEXT_PUBLIC_APP_URL (optional)           – e.g. https://goal-tracker-web.vercel.app
 */
import crypto from 'crypto';
import { getSupabaseAdmin } from '@/lib/supabase';

export const GARMIN_AUTHORIZE_URL = 'https://connect.garmin.com/oauth2Confirm';
export const GARMIN_TOKEN_URL = 'https://diauth.garmin.com/di-oauth2-service/oauth/token';
export const GARMIN_API_BASE = 'https://apis.garmin.com/wellness-api/rest';

export function garminConfig() {
  const clientId = process.env.GARMIN_CLIENT_ID;
  const clientSecret = process.env.GARMIN_CLIENT_SECRET;
  return { clientId, clientSecret, configured: !!clientId && !!clientSecret };
}

export function appBaseUrl(requestUrl: string): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (configured) return configured.replace(/\/$/, '');
  return new URL(requestUrl).origin;
}

export function redirectUri(requestUrl: string): string {
  return `${appBaseUrl(requestUrl)}/api/garmin/callback`;
}

/** Check the site PIN sent by the browser (header or JSON body). */
export function isPinValid(pin: string | null | undefined): boolean {
  const sitePin = process.env.SITE_PIN;
  if (!sitePin || !pin) return false;
  const a = Buffer.from(pin.trim());
  const b = Buffer.from(sitePin.trim());
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/* ─── PKCE ─────────────────────────────────────────────────────────────── */

function base64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function createPkcePair() {
  const codeVerifier = base64url(crypto.randomBytes(48)); // 64 chars, within 43–128
  const codeChallenge = base64url(crypto.createHash('sha256').update(codeVerifier).digest());
  const state = base64url(crypto.randomBytes(24));
  return { codeVerifier, codeChallenge, state };
}

/* ─── Tokens ───────────────────────────────────────────────────────────── */

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  refresh_token_expires_in?: number;
  scope?: string;
  token_type?: string;
}

async function requestToken(params: Record<string, string>): Promise<TokenResponse> {
  const { clientId, clientSecret } = garminConfig();
  if (!clientId || !clientSecret) throw new Error('Garmin client credentials are not configured');

  const res = await fetch(GARMIN_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ ...params, client_id: clientId, client_secret: clientSecret }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Garmin token request failed (${res.status}): ${text.slice(0, 300)}`);
  return JSON.parse(text) as TokenResponse;
}

export function exchangeCode(code: string, codeVerifier: string, redirect: string) {
  return requestToken({
    grant_type: 'authorization_code',
    code,
    code_verifier: codeVerifier,
    redirect_uri: redirect,
  });
}

function tokenRow(t: TokenResponse) {
  const now = Date.now();
  return {
    access_token: t.access_token,
    refresh_token: t.refresh_token,
    // Refresh a minute early to avoid edge-of-expiry failures
    access_token_expires_at: new Date(now + (t.expires_in - 60) * 1000).toISOString(),
    refresh_token_expires_at: t.refresh_token_expires_in
      ? new Date(now + t.refresh_token_expires_in * 1000).toISOString()
      : null,
    scope: t.scope ?? null,
    updated_at: new Date().toISOString(),
  };
}

export async function saveConnection(userId: string, t: TokenResponse) {
  const supabase = getSupabaseAdmin();
  const row = { user_id: userId, ...tokenRow(t) };

  // Look up the Garmin user id so webhook payloads can be matched to us
  const garminUserId = await fetchGarminUserId(t.access_token);

  const { error } = await supabase
    .from('garmin_connections')
    .upsert({ ...row, garmin_user_id: garminUserId, connected_at: new Date().toISOString() });
  if (error) throw new Error(`Failed to save Garmin connection: ${error.message}`);

  return garminUserId;
}

async function fetchGarminUserId(accessToken: string): Promise<string | null> {
  const res = await fetch(`${GARMIN_API_BASE}/user/id`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    console.error('[Garmin] user/id failed', res.status, await res.text().catch(() => ''));
    return null;
  }
  const body = (await res.json()) as { userId?: string };
  return body.userId ?? null;
}

export interface GarminConnection {
  user_id: string;
  garmin_user_id: string | null;
  access_token: string;
  refresh_token: string;
  access_token_expires_at: string;
  refresh_token_expires_at: string | null;
  scope: string | null;
  permissions: string[] | null;
  connected_at: string;
  last_data_at: string | null;
}

/** Return a non-expired access token for the user, refreshing it if needed. */
export async function getValidAccessToken(conn: GarminConnection): Promise<string> {
  if (new Date(conn.access_token_expires_at).getTime() > Date.now()) return conn.access_token;

  const t = await requestToken({ grant_type: 'refresh_token', refresh_token: conn.refresh_token });
  const { error } = await getSupabaseAdmin()
    .from('garmin_connections')
    .update(tokenRow(t))
    .eq('user_id', conn.user_id);
  if (error) console.error('[Garmin] failed to persist refreshed token', error.message);
  return t.access_token;
}

export async function getConnectionByGarminUser(garminUserId: string): Promise<GarminConnection | null> {
  const { data } = await getSupabaseAdmin()
    .from('garmin_connections')
    .select('*')
    .eq('garmin_user_id', garminUserId)
    .maybeSingle();
  return (data as GarminConnection) ?? null;
}

export async function getConnectionByUser(userId: string): Promise<GarminConnection | null> {
  const { data } = await getSupabaseAdmin()
    .from('garmin_connections')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  return (data as GarminConnection) ?? null;
}

/** Tell Garmin to stop sending data for this user, then forget the tokens. */
export async function disconnect(conn: GarminConnection) {
  try {
    const token = await getValidAccessToken(conn);
    const res = await fetch(`${GARMIN_API_BASE}/user/registration`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok && res.status !== 404) {
      console.error('[Garmin] deregistration failed', res.status, await res.text().catch(() => ''));
    }
  } catch (e) {
    console.error('[Garmin] deregistration error', e);
  }
  await getSupabaseAdmin().from('garmin_connections').delete().eq('user_id', conn.user_id);
}

/* ─── Summaries ────────────────────────────────────────────────────────── */

type Summary = Record<string, unknown> & {
  userId?: string;
  summaryId?: string;
  calendarDate?: string;
  startTimeInSeconds?: number;
  durationInSeconds?: number;
};

function summaryKey(type: string, s: Summary): string {
  if (s.summaryId) return String(s.summaryId);
  // Some summary types (e.g. userMetrics) may not carry summaryId
  return `${s.userId ?? 'unknown'}-${s.calendarDate ?? s.startTimeInSeconds ?? crypto.randomUUID()}`;
}

/** Upsert summaries of one type for one connection. Returns count stored. */
export async function storeSummaries(
  conn: GarminConnection,
  summaryType: string,
  summaries: Summary[]
): Promise<number> {
  if (summaries.length === 0) return 0;

  const rows = summaries.map((s) => {
    const { userAccessToken: _omit, ...data } = s as Summary & { userAccessToken?: string };
    void _omit;
    return {
      user_id: conn.user_id,
      garmin_user_id: String(s.userId ?? conn.garmin_user_id ?? ''),
      summary_type: summaryType,
      summary_id: summaryKey(summaryType, s),
      calendar_date: s.calendarDate ?? (s.startTimeInSeconds
        ? new Date(s.startTimeInSeconds * 1000).toISOString().slice(0, 10)
        : null),
      start_time: s.startTimeInSeconds ? new Date(s.startTimeInSeconds * 1000).toISOString() : null,
      duration_seconds: typeof s.durationInSeconds === 'number' ? s.durationInSeconds : null,
      data,
      received_at: new Date().toISOString(),
    };
  });

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from('garmin_summaries')
    .upsert(rows, { onConflict: 'summary_type,summary_id' });
  if (error) throw new Error(`Failed to store ${summaryType}: ${error.message}`);

  await supabase
    .from('garmin_connections')
    .update({ last_data_at: new Date().toISOString() })
    .eq('user_id', conn.user_id);

  return rows.length;
}

/** In ping mode Garmin sends a callbackURL; fetch the actual summaries from it. */
export async function fetchPingCallback(conn: GarminConnection, callbackURL: string): Promise<Summary[]> {
  const url = new URL(callbackURL);
  if (url.hostname !== 'apis.garmin.com') throw new Error(`Refusing callback to ${url.hostname}`);
  const token = await getValidAccessToken(conn);
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Ping callback failed (${res.status})`);
  const body = await res.json();
  return Array.isArray(body) ? body : [];
}

/**
 * Ask Garmin to re-send historical data (it arrives later via the webhook).
 * Backfill windows are limited to 90 days per request.
 */
export async function requestBackfill(conn: GarminConnection, summaryType: string, days: number) {
  const token = await getValidAccessToken(conn);
  const end = Math.floor(Date.now() / 1000);
  const start = end - Math.min(days, 90) * 86400;
  const url = `${GARMIN_API_BASE}/backfill/${summaryType}?summaryStartTimeInSeconds=${start}&summaryEndTimeInSeconds=${end}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  // 202 Accepted = queued; 409 = a backfill for this window already exists
  return { summaryType, status: res.status, ok: res.status === 202 || res.status === 409 };
}

export const BACKFILL_TYPES = [
  'dailies',
  'sleeps',
  'hrv',
  'stressDetails',
  'pulseox',
  'respiration',
  'userMetrics',
  'bodyComps',
  'activities',
];
