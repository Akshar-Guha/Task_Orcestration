import crypto from 'crypto';

/**
 * Shared auth for /api/watch/* routes called by the Garmin Connect IQ apps.
 * The watch sends header `x-watch-key`, which must equal WATCH_INGEST_KEY.
 */
export function watchKeyOk(given: string | null): boolean {
  const expected = process.env.WATCH_INGEST_KEY;
  if (!expected || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function watchAuthorized(request: { headers: Headers }): boolean {
  return watchKeyOk(request.headers.get('x-watch-key'));
}

/**
 * Watch key OR a PIN-authorised browser device (header `x-device-token`,
 * stored in authorized_devices when the PIN was entered). Used so the TV
 * dashboard (/tv) can read tasks and act on them like the watch does.
 */
export async function watchOrDeviceAuthorized(request: { headers: Headers }): Promise<boolean> {
  if (watchAuthorized(request)) return true;
  const token = request.headers.get('x-device-token');
  if (!token || token.length < 16 || token.length > 200) return false;
  const { getSupabaseAdmin } = await import('@/lib/supabase');
  const { data } = await getSupabaseAdmin()
    .from('authorized_devices')
    .select('id')
    .eq('device_token', token)
    .maybeSingle();
  return !!data;
}
