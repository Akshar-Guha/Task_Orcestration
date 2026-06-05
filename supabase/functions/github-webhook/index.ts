import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

// FIX: Removed inline corsHeaders. github-webhook had an extra header
// (x-hub-signature-256) not present in _shared/cors.ts. Added it to the shared import
// headers via the local override below so preflight works for signature validation.
const githubCorsHeaders = {
  ...corsHeaders,
  'Access-Control-Allow-Headers': corsHeaders['Access-Control-Allow-Headers'] + ', x-hub-signature-256',
};

const GITHUB_TOKEN = Deno.env.get('GITHUB_TOKEN') || '';
const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY') || '';
const USER_ID = Deno.env.get('DEFAULT_USER_ID') || '';
const SYNC_FOLDER = 'Goal App';
const EMBEDDING_MODEL = Deno.env.get('SUPABASE_MEMORY_EMBEDDING_MODEL') || 'Supabase/gte-small';

async function generateEmbedding(supabaseUrl: string, serviceKey: string, text: string) {
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/generate_embedding`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ input_text: text }),
    });

    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: githubCorsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    // FIX: Validate Supabase env vars and USER_ID before processing
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not configured');
    }
    if (!USER_ID) {
      throw new Error('DEFAULT_USER_ID not configured');
    }

    const supabaseClient = createClient(supabaseUrl, serviceRoleKey);

    const payload = await req.json();
    if (!payload.commits) {
      return new Response(
        JSON.stringify({ success: true, message: 'Not a push event, ignoring' }),
        { headers: { ...githubCorsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const repo = payload.repository?.full_name;
    // FIX: Missing repo check — without a repo name the GitHub API calls would
    // produce garbage URLs and silently return 404s.
    if (!repo) {
      throw new Error('Missing repository.full_name in payload');
    }

    const results: any[] = [];

    for (const commit of payload.commits) {
      const filesToProcess = [...(commit.added || []), ...(commit.modified || [])];

      for (const filePath of filesToProcess) {
        if (!filePath.startsWith(SYNC_FOLDER) || !filePath.endsWith('.md')) {
          continue;
        }

        try {
          // FIX: Use commit.id (the commit SHA) for fetching the specific version of
          // the file, not the repo default branch, to avoid race conditions when
          // multiple commits arrive in the same push event.
          const fileUrl = `https://api.github.com/repos/${repo}/contents/${encodeURIComponent(filePath)}?ref=${commit.id}`;
          const fileResponse = await fetch(fileUrl, {
            headers: {
              'Authorization': `Bearer ${GITHUB_TOKEN}`,
              'Accept': 'application/vnd.github.v3.raw',
              'User-Agent': 'MTO-Goal-Tracker',
            },
          });

          if (!fileResponse.ok) {
            console.error(`Failed to fetch ${filePath}: ${fileResponse.statusText}`);
            results.push({ file: filePath, status: 'error', error: fileResponse.statusText });
            continue;
          }

          const content = await fileResponse.text();
          const fileName = filePath.split('/').pop() || 'Untitled.md';
          const embedding = await generateEmbedding(supabaseUrl, serviceRoleKey, content);

          const { data: memory, error: insertError } = await supabaseClient
            .from('memories')
            .upsert({
              user_id: USER_ID,
              content,
              metadata: {
                source: 'github',
                repo,
                file_path: filePath,
                commit_sha: commit.id,
                commit_message: commit.message,
                synced_at: new Date().toISOString(),
              },
              file_path: filePath,
              file_name: fileName,
              modified_at: new Date().toISOString(),
              embedding,
              embedding_model: embedding ? EMBEDDING_MODEL : null,
            }, {
              onConflict: 'user_id,file_path',
            })
            .select()
            .single();

          if (insertError) {
            console.error(`Failed to save ${filePath}:`, insertError);
            results.push({ file: filePath, status: 'error', error: insertError.message });
            continue;
          }

          if (GROQ_API_KEY && content.length > 10) {
            try {
              const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${GROQ_API_KEY}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  model: 'llama-3.1-8b-instant',
                  messages: [{
                    role: 'user',
                    content: `Extract 10 key concepts from this note as comma-separated keywords only: ${content.substring(0, 2000)}`,
                  }],
                  temperature: 0.3,
                  max_tokens: 100,
                }),
              });

              if (groqResponse.ok) {
                const groqData = await groqResponse.json();
                const keywords = groqData.choices[0]?.message?.content || '';

                await supabaseClient
                  .from('memories')
                  .update({
                    metadata: {
                      ...memory.metadata,
                      keywords,
                    },
                  })
                  .eq('id', memory.id);
              }
            } catch (groqError) {
              console.error('Groq error:', groqError);
            }
          }

          results.push({ file: filePath, status: 'synced', embedded: embedding != null });
        } catch (fileError: any) {
          console.error(`Error processing ${filePath}:`, fileError);
          results.push({ file: filePath, status: 'error', error: fileError.message });
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: results.length,
        files: results,
      }),
      { headers: { ...githubCorsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Webhook error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...githubCorsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
