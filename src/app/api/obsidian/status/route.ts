/**
 * Obsidian Status API Route
 * 
 * Returns whether Obsidian (GitHub) sync is configured.
 */

import { NextResponse } from 'next/server';

export async function GET() {
  const configured = !!(
    process.env.GITHUB_TOKEN &&
    process.env.GITHUB_OWNER &&
    process.env.GITHUB_REPO
  );

  return NextResponse.json({
    configured,
    owner: process.env.GITHUB_OWNER || null,
    repo: process.env.GITHUB_REPO || null,
  });
}
