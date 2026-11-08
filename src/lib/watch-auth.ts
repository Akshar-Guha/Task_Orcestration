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
