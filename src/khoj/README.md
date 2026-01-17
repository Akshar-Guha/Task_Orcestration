# Khoj Integration Directory

This directory contains Khoj-related integration code for the MTO Second Brain.

## Structure

```
src/khoj/
├── README.md                    # This file
├── index.ts                     # Barrel export
├── config/
│   └── khoj.config.ts          # Configuration
├── lib/
│   ├── khoj-client.ts          # Server-side API client
│   └── markdown-converter.ts   # Convert data → markdown
└── components/
    └── SemanticSearch.tsx      # Search UI component

src/app/
├── api/khoj/search/route.ts    # Next.js API route (proxy)
└── search/page.tsx             # Search page

supabase/functions/
└── khoj-sync/index.ts          # Edge Function (Supabase → Khoj)
```

## Prerequisites Checklist

- [ ] Oracle Cloud VM deployed (see oracle_cloud_setup.md)
- [ ] Docker + Docker Compose installed
- [ ] Khoj running at `https://khoj.yourdomain.com`
- [ ] Khoj API key generated
- [ ] Environment variables configured
- [ ] DNS pointing to Oracle Cloud IP

## Environment Variables Required

```bash
# Add to .env.local (server-side only, NO NEXT_PUBLIC_ prefix)
KHOJ_URL=https://khoj.yourdomain.com
KHOJ_API_KEY=your-api-key-here
```
