import { NextResponse } from 'next/server';
import { getCurrentUserId } from '@/lib/user';

export async function POST() {
  console.log('[API] Test notification requested');

  try {
    const userId = getCurrentUserId();
    
    if (!userId) {
      return NextResponse.json({ error: 'User not found' }, { status: 400 });
    }

    // Call the send endpoint internally
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 
                    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 
                    'http://localhost:3000';

    const response = await fetch(`${baseUrl}/api/push/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: '🧪 Test Notification',
        body: 'If you see this, push notifications are working!',
        url: '/settings/notifications',
        userId
      })
    });

    const result = await response.json();
    
    if (result.success) {
      return NextResponse.json({ 
        success: true, 
        message: `Test notification sent to ${result.sent} device(s)`,
        ...result
      });
    } else {
      return NextResponse.json({ 
        success: false, 
        error: result.error || 'Failed to send notification'
      }, { status: 500 });
    }
  } catch (error) {
    console.error('[API] Test notification error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal error sending test notification' 
    }, { status: 500 });
  }
}
