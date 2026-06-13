import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getCurrentUserId } from '@/lib/user';
import { github } from '@/lib/github';
import { generateEmbedding } from '@/lib/server-embedding';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    // 1. Verify Site Pin or Authorization header for security
    const pin = process.env.SITE_PIN || '123456';
    const authHeader = request.headers.get('authorization');
    const customHeader = request.headers.get('x-site-pin');
    
    const isAuth = 
      (authHeader && authHeader === `Bearer ${pin}`) || 
      (customHeader && customHeader === pin);
      
    // Fallback: If not explicitly authorized via PIN, check if we have a valid user ID (PWA internal requests)
    const userId = getCurrentUserId();
    
    if (!isAuth && !userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const targetUserId = userId || '2c32a446-1bbc-4294-8a29-3e4fef5649e6';

    // 2. Parse request body
    const body = await request.json();
    const { reviews, obsidianPath = 'Task_Reviews.md' } = body;

    if (!reviews || !Array.isArray(reviews) || reviews.length === 0) {
      return NextResponse.json({ error: 'reviews array is required' }, { status: 400 });
    }

    const results = [];
    const obsidianEntries: string[] = [];
    const nowStr = new Date().toISOString();
    const localTimeStr = new Date().toLocaleString();

    for (const review of reviews) {
      const { taskId, taskTitle, status, feedback = '' } = review;
      
      if (!taskId || !taskTitle || !status) {
        continue;
      }

      // 1. Update the task status in the database
      const isCompleted = status === 'completed';
      const { error: taskUpdateError } = await supabase
        .from('tasks')
        .update({
          is_completed: isCompleted,
          completed_at: isCompleted ? nowStr : null,
          updated_at: nowStr
        })
        .eq('id', taskId)
        .eq('user_id', targetUserId);

      if (taskUpdateError) {
        console.error(`[Reviews API] Failed to update task ${taskId}:`, taskUpdateError);
      }

      // 2. Insert review log into task_reviews
      const { data: reviewData, error: reviewInsertError } = await supabase
        .from('task_reviews')
        .insert({
          user_id: targetUserId,
          task_id: taskId,
          task_title: taskTitle,
          status,
          feedback,
          created_at: nowStr,
          updated_at: nowStr
        })
        .select()
        .single();

      if (reviewInsertError) {
        console.error(`[Reviews API] Failed to insert review:`, reviewInsertError);
        continue;
      }

      // 3. Format entry for Obsidian
      const entryMarkdown = `### Task Review - ${localTimeStr}
- **Task**: ${taskTitle}
- **Status**: ${status.toUpperCase()}
- **Feedback**: ${feedback || 'No feedback provided.'}
`;
      obsidianEntries.push(entryMarkdown);

      // 4. Generate embedding and index into memories table for semantic RAG retrieval
      const memoryContent = `Task Review: ${taskTitle}
Status: ${status}
Feedback: ${feedback || 'None'}
Date: ${localTimeStr}`;

      const { embedding, modelName } = await generateEmbedding(memoryContent);

      const { error: memoryInsertError } = await supabase
        .from('memories')
        .insert({
          user_id: targetUserId,
          content: memoryContent,
          metadata: {
            source: 'task_review',
            task_id: taskId,
            status,
            feedback,
            reviewed_at: nowStr
          },
          file_path: `task_reviews/${reviewData.id}.md`,
          file_name: `review-${reviewData.id}.md`,
          modified_at: nowStr,
          tags: ['task_review', status],
          embedding,
          embedding_model: modelName
        });

      if (memoryInsertError) {
        console.error(`[Reviews API] Failed to insert memory for review ${reviewData.id}:`, memoryInsertError);
      }

      results.push(reviewData);
    }

    // 5. Sync to Obsidian via GitHub API (Append mode)
    if (obsidianEntries.length > 0 && github.isConfigured()) {
      const appendText = obsidianEntries.join('\n');
      const existingFile = await github.getFile(obsidianPath);

      let finalContent = '';
      let sha: string | undefined;

      if (existingFile) {
        finalContent = `${existingFile.content}\n\n${appendText}`;
        sha = existingFile.sha;
      } else {
        finalContent = `# Task Reviews Log\n\n${appendText}`;
      }

      const uploadResult = await github.upsertFile(
        {
          path: obsidianPath,
          content: finalContent,
          sha
        },
        `[Shortcuts] Logged ${obsidianEntries.length} task review(s)`
      );

      if (!uploadResult) {
        console.warn(`[Reviews API] Failed to sync reviews to Obsidian path: ${obsidianPath}`);
      }
    }

    return NextResponse.json({
      success: true,
      processed: results.length,
      reviews: results
    });

  } catch (error) {
    console.error('[Shortcuts Reviews API] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
