import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Client for browser usage (anon key)
// Client for browser usage (anon key)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn('⚠️ Supabase environment variables missing. Using placeholder client. Queries will fail.');
}

export const supabase = (supabaseUrl && supabaseKey) 
  ? createClient(supabaseUrl, supabaseKey)
  // Fallback for build time or missing env
  : createClient('https://placeholder.supabase.co', 'placeholder');

// Admin client for server-side operations (service role key)
// Only initialize on server to prevent client-side crashes
let _supabaseAdmin: SupabaseClient | null = null;

export const getSupabaseAdmin = (): SupabaseClient => {
  if (typeof window !== 'undefined') {
    throw new Error('supabaseAdmin can only be used on the server');
  }
  
  if (!_supabaseAdmin) {
    _supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }
  
  return _supabaseAdmin;
};

// For backward compatibility (only use in server components/API routes)
// Throws at runtime if accidentally used on the client
export const supabaseAdmin: SupabaseClient = typeof window === 'undefined'
  ? createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    )
  : new Proxy({} as SupabaseClient, {
      get() {
        throw new Error('supabaseAdmin cannot be used on the client side');
      }
    });
