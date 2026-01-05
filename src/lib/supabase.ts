import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Client for browser usage (anon key)
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Admin client for server-side operations (service role key)
// Only initialize on server to prevent client-side crashes
let _supabaseAdmin: SupabaseClient | null = null;

export const getSupabaseAdmin = (): SupabaseClient => {
  if (typeof window !== 'undefined') {
    throw new Error('supabaseAdmin can only be used on the server');
  }
  
  if (!_supabaseAdmin) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!url || !key) {
      throw new Error('Missing Supabase environment variables');
    }
    
    _supabaseAdmin = createClient(url, key);
  }
  
  return _supabaseAdmin;
};

// For backward compatibility (only use in server components/API routes)
// Returns undefined during build time if env vars are missing
export const supabaseAdmin = (() => {
  if (typeof window !== 'undefined') {
    return null as unknown as SupabaseClient;
  }
  
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  // Return undefined during build if env vars not available
  if (!url || !key) {
    return undefined as unknown as SupabaseClient;
  }
  
  return createClient(url, key);
})();

