import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getCurrentUserId } from '@/lib/user';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    // 1. Verify Site Pin / Authorization
    const pin = process.env.SITE_PIN || '123456';
    const authHeader = request.headers.get('authorization');
    const customHeader = request.headers.get('x-site-pin');
    
    const isAuth = 
      (authHeader && authHeader === `Bearer ${pin}`) || 
      (customHeader && customHeader === pin);
      
    if (!isAuth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: 'User not configured' }, { status: 401 });
    }

    // 2. Parse body
    const body = await request.json();
    const { message } = body;
    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // 3. Create a test notification in the database
    const { data, error } = await supabase
      .from('notification_rules')
      .insert({
        user_id: userId,
        title: 'Assistant Shortcut Test',
        body: `Successfully received voice/text input from Apple Shortcut!\n\nMessage: "${message}"\n\nTimestamp: ${new Date().toLocaleString()}`,
        notification_type: 'shortcut_output',
        is_enabled: true,
        is_manual: true,
        requires_acknowledgment: true,
      })
      .select()
      .single();

    if (error) {
      console.error('[Shortcuts Test] Database error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      response: `Connection successful! PWA received your message: "${message}". An overlay has been queued in your dashboard.`,
      notification: data,
    });

  } catch (error) {
    console.error('[Shortcuts Test API] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
