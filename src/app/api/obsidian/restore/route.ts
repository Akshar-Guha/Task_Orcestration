/**
 * Obsidian Restore API Route
 * 
 * Triggers a full restore from Obsidian vault.
 */

import { NextResponse } from 'next/server';
import { fullRestore, restoreGoals, restoreTasks } from '@/lib/obsidian-restore';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { type } = body;

    if (type === 'goals') {
      const result = await restoreGoals();
      return NextResponse.json({
        success: result.errors.length === 0,
        restored: result.goals.length,
        data: result.goals,
        errors: result.errors,
      });
    }

    if (type === 'tasks') {
      const result = await restoreTasks();
      return NextResponse.json({
        success: result.errors.length === 0,
        restored: result.tasks.length,
        data: result.tasks,
        errors: result.errors,
      });
    }

    // Full restore
    const result = await fullRestore();
    return NextResponse.json(result);

  } catch (error) {
    console.error('[Restore] Error:', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    usage: 'POST with optional { type: "goals" | "tasks" }',
    description: 'Restore data from Obsidian vault',
  });
}
