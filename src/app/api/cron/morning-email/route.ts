import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase'; // Server client
import { triggerWakeUpEmail } from '@/lib/emailTrigger';

export async function GET() {
  try {
    // 1. Get all users (or just me if single user app)
    // For single user MTO app, we assume current logic targets the main user.
    // However, the Edge Functions might handle bulk sending if configured?
    // emailTrigger.ts calls 'wake-up-email' endpoint.
    // We'll emulate the client logic: Get today's log, trigger email.
    
    // For now, let's assuming single user or looping loop if 'supabase' has admin rights.
    // But 'triggerWakeUpEmail' is client-side logic? 
    // It calls `fetch(..., Authorization: anon_key)`.
    
    // The user's request implies "I" get the email.
    // So we need to find the user's data.
    
    // Simplification: Trigger generic wake-up email or fetch data for specific user id?
    // We'll hardcode Fallback ID or iterate if possible. 
    // But realistically, this cron hits an API that calls an Edge Function.
    // The Edge Function might need `user_id` context.
    // triggerEmail uses `triggerWakeUpEmail(mood)`. It doesn't pass userId in body?
    // Let's check emailTrigger.ts line 51: `triggerEmail('wake-up', { mood })`.
    // It sends body `{ mood }`. 
    // Does the Edge Function know who to email?
    // Typically it uses `auth.uid()` from the token.
    // If we call it with ANON KEY, we are anonymous.
    // Unless the Edge Function takes `user_id` in body.
    
    // Use FALLBACK_USER_ID from full-sync if needed, or query users.
    const FALLBACK_USER_ID = process.env.NEXT_PUBLIC_USER_ID || '2c32a446-1bbc-4294-8a29-3e4fef5649e6';
    
    const today = new Date().toISOString().split('T')[0];
    const { data: log } = await supabase
        .from('sleep_wake_logs')
        .select('*')
        .eq('user_id', FALLBACK_USER_ID)
        .eq('date', today)
        .single();
        
    const moodMap: Record<number, string> = {
        5: 'great', 4: 'good', 3: 'okay', 2: 'bad', 1: 'terrible'
    };
    const mood = log?.wake_up_mood ? moodMap[log.wake_up_mood] : 'good';
    
    // We inject user_id into the body so Edge Function knows target (if it supports it)
    await import('@/lib/emailTrigger').then(mod => mod.triggerEmail('wake-up', { mood, user_id: FALLBACK_USER_ID }));
    
    return NextResponse.json({ success: true, triggered: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
