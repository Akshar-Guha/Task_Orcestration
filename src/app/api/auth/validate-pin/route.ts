import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { pin } = await request.json();
    const sitePin = process.env.SITE_PIN;
    
    if (!sitePin) {
      console.error('[Auth] SITE_PIN not configured');
      return NextResponse.json({ valid: false, error: 'PIN not configured' }, { status: 500 });
    }
    
    const valid = pin.trim() === sitePin.trim();
    
    // Log result only (never log actual PIN values)
    console.log('[Auth] PIN validation result:', { valid });
    
    return NextResponse.json({ valid });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Validation failed';
    return NextResponse.json({ valid: false, error: message }, { status: 500 });
  }
}
