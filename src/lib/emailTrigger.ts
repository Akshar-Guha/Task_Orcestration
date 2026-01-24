/**
 * Email Trigger Service
 * 
 * Called from frontend after recordWakeUp() or recordSleep() actions.
 * Triggers the appropriate email Edge Function.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

type EmailType = 'wake-up' | 'sleep';

export async function triggerEmail(type: EmailType, data?: Record<string, unknown>): Promise<boolean> {
  try {
    console.log(`[Email] Triggering ${type} email...`, data);
    
    // Use correct Edge Function URLs
    const functionUrl = `${SUPABASE_URL}/functions/v1/${type}-email`;
    
    console.log(`[Email] Calling function: ${functionUrl}`);
    
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data || {}),
    });

    console.log(`[Email] Response status: ${response.status}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Email] Failed to trigger ${type} email:`, errorText);
      return false;
    }

    const result = await response.json();
    console.log(`[Email] ${type} email sent successfully:`, result);
    return result.success !== false;

  } catch (error) {
    console.error(`[Email] Error triggering ${type} email:`, error);
    return false;
  }
}

export async function triggerWakeUpEmail(mood?: string): Promise<boolean> {
  console.log('[Email] Wake-up email triggered with mood:', mood);
  return triggerEmail('wake-up', { mood });
}

export async function triggerSleepEmail(): Promise<boolean> {
  console.log('[Email] Sleep email triggered');
  return triggerEmail('sleep');
}
