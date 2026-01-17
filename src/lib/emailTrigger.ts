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
    const functionName = type === 'wake-up' ? 'wake-up-email' : 'sleep-email';
    
    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/${functionName}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data || {}),
      }
    );

    if (!response.ok) {
      console.error(`[Email] Failed to trigger ${type} email:`, await response.text());
      return false;
    }

    const result = await response.json();
    console.log(`[Email] ${type} email sent:`, result);
    return result.success;

  } catch (error) {
    console.error(`[Email] Error triggering ${type} email:`, error);
    return false;
  }
}

export async function triggerWakeUpEmail(mood?: string): Promise<boolean> {
  return triggerEmail('wake-up', { mood });
}

export async function triggerSleepEmail(): Promise<boolean> {
  return triggerEmail('sleep');
}
