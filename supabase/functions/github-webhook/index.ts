import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-hub-signature-256',
};

// GitHub Personal Access Token (will be set in environment)
const GITHUB_TOKEN = Deno.env.get('GITHUB_TOKEN') || '';
const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY') || '';
const USER_ID = Deno.env.get('DEFAULT_USER_ID') || '';
const SYNC_FOLDER = 'Goal App';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const payload = await req.json();
    
    // GitHub sends push events
    if (!payload.commits) {
      return new Response(
        JSON.stringify({ success: true, message: 'Not a push event, ignoring' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const repo = payload.repository?.full_name;
    const results: any[] = [];

    // Process each commit
    for (const commit of payload.commits) {
      // Get added and modified files
      const filesToProcess = [...(commit.added || []), ...(commit.modified || [])];
      
      for (const filePath of filesToProcess) {
        // Only process files in Goal App folder
        if (!filePath.startsWith(SYNC_FOLDER)) {
          continue;
        }

        // Only process markdown files
        if (!filePath.endsWith('.md')) {
          continue;
        }

        try {
          // Fetch file content from GitHub API
          const fileUrl = `https://api.github.com/repos/${repo}/contents/${encodeURIComponent(filePath)}`;
          const fileResponse = await fetch(fileUrl, {
            headers: {
              'Authorization': `Bearer ${GITHUB_TOKEN}`,
              'Accept': 'application/vnd.github.v3.raw',
              'User-Agent': 'MTO-Goal-Tracker'
            }
          });

          if (!fileResponse.ok) {
            console.error(`Failed to fetch ${filePath}: ${fileResponse.statusText}`);
            continue;
          }

          const content = await fileResponse.text();

          // Store in memories table
          const { data: memory, error: insertError } = await supabaseClient
            .from('memories')
            .upsert({
              user_id: USER_ID,
              content: content,
              metadata: {
                source: 'github',
                repo: repo,
                file_path: filePath,
                commit_sha: commit.id,
                commit_message: commit.message,
                synced_at: new Date().toISOString()
              }
            }, {
              onConflict: 'user_id,metadata->file_path'
            })
            .select()
            .single();

          if (insertError) {
            console.error(`Failed to save ${filePath}:`, insertError);
            continue;
          }

          // Extract keywords with Groq
          if (GROQ_API_KEY && content.length > 10) {
            try {
              const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${GROQ_API_KEY}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  model: 'llama-3.1-8b-instant',
                  messages: [{
                    role: 'user',
                    content: `Extract 10 key concepts from this note as comma-separated keywords only: ${content.substring(0, 2000)}`
                  }],
                  temperature: 0.3,
                  max_tokens: 100
                })
              });

              if (groqResponse.ok) {
                const groqData = await groqResponse.json();
                const keywords = groqData.choices[0]?.message?.content || '';
                
                await supabaseClient
                  .from('memories')
                  .update({ 
                    metadata: { 
                      ...memory.metadata,
                      keywords: keywords
                    }
                  })
                  .eq('id', memory.id);
              }
            } catch (groqError) {
              console.error('Groq error:', groqError);
            }
          }

          results.push({ file: filePath, status: 'synced' });
        } catch (fileError) {
          console.error(`Error processing ${filePath}:`, fileError);
          results.push({ file: filePath, status: 'error', error: fileError.message });
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: results.length,
        files: results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Webhook error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
