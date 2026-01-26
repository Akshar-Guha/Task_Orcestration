import { NextResponse } from 'next/server';

export async function GET() {
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  return NextResponse.json({
    public_key: {
      present: !!pub,
      length: pub ? pub.length : 0,
      prefix: pub ? pub.substring(0, 5) : 'N/A'
    },
    private_key: {
      present: !!priv,
      length: priv ? priv.length : 0,
      prefix: priv ? priv.substring(0, 5) : 'N/A'
    },
    service_role: {
      present: !!key,
      length: key ? key.length : 0
    },
    supabase_url: {
      present: !!url
    }
  });
}
