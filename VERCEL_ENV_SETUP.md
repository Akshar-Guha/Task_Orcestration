Vercel Environment Variables are **MISSING**. The diary API is failing because these are not set:

## 🔴 Required Variables

Add these to your Vercel project at: **https://vercel.com/dashboard** → Your Project → Settings → Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=https://vcbzzpxovqetxybpkrzo.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZjYnp6cHhvdnFldHh5YnBrcnpvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcxMDc3NDEsImV4cCI6MjA4MjY4Mzc0MX0.eiIEeQg5rQHk-LR2LcdSSfbnHmN84MVRR4lcyXw0L0Y
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZjYnp6cHhvdnFldHh5YnBrcnpvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzEwNzc0MSwiZXhwIjoyMDgyNjgzNzQxfQ.4MQgM63XQFpsS_5zkry2UkP-rFVUtdsIB3UZrFNV5p4
NEXT_PUBLIC_USER_ID=2c32a446-1bbc-4294-8a29-3e4fef5649e6
```

## 📖 Steps to Fix

1. Go to: https://vercel.com/dashboard
2. Click your project (`goal-tracker-web`)
3. Go to: **Settings** → **Environment Variables**
4. Add each variable above (one at a time)
5. Set to: **Production, Preview, Development** (all 3)
6. Click "Save"
7. **Redeploy** the app (Settings → Deployments → Latest → Redeploy)

After redeployment (~1 min), the diary will work!
