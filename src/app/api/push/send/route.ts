import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserId } from '@/lib/user';
import { sendPushNotification } from '@/lib/push/server';

export async function POST(request: NextRequest) {
  try {
    const { title, body, icon, url, userId: targetUserId } = await request.json();
    const requestingUserId = getCurrentUserId();
    const userId = targetUserId || requestingUserId;

    if (!userId) {
      return NextResponse.json({ error: 'User not specified' }, { status: 400 });
    }

    if (!title || !body) {
      return NextResponse.json({ error: 'Title and body required' }, { status: 400 });
    }

    const result = await sendPushNotification(userId, { title, body, icon });

    if (!result.success && result.error) {
       // Return 200 even if failed, but with success: false, unless it's a configuration error
       return NextResponse.json(result, { status: result.error.includes('VAPID') ? 500 : 200 });
    }

    return NextResponse.json(result);

  } catch (error) {
    console.error('[Push Send] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
