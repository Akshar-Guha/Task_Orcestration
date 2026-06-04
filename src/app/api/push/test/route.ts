import { NextResponse } from 'next/server';
import { getCurrentUserId } from '@/lib/user';
import { sendPushNotification } from '@/lib/push/server';

export async function POST() {
  console.log('[API] Test notification requested');

  try {
    const userId = getCurrentUserId();
    
    if (!userId) {
      return NextResponse.json({ error: 'User not found' }, { status: 400 });
    }

    // Call logic directly, DO NOT use fetch() to avoid loopback issues in Vercel
    const result = await sendPushNotification(userId, {
      title: '🧪 Test Notification',
      body: 'If you see this, push notifications are working!',
    });
    
    if (result.success) {
      return NextResponse.json({
        ...result,
        message: `Test notification sent to ${result.sent} device(s)`,
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
      error: `Internal Test Error: ${error instanceof Error ? error.message : String(error)}` 
    }, { status: 500 });
  }
}
