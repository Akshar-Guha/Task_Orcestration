import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

// FIX: Removed inline corsHeaders duplicate; import from _shared/cors.ts

const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY') || '';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    // FIX: Validate Supabase config before proceeding
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not configured');
    }

    const supabaseClient = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json();
    const { file_path, file_name, content, user_id, modified_at } = body;

    // FIX: Validate required fields
    if (!content || !user_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields: content, user_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // FIX: Include file_path and file_name in insert so the upsert conflict key works
    // (memories table has a unique index on user_id, file_path WHERE file_path IS NOT NULL)
    const { data: memory, error: insertError } = await supabaseClient
      .from('memories')
      .upsert({
        user_id: user_id,
        content: content,
        file_path: file_path || null,
        file_name: file_name || null,
        modified_at: modified_at || new Date().toISOString(),
        metadata: {},
      }, {
        onConflict: file_path ? 'user_id,file_path' : undefined,
        ignoreDuplicates: false,
      })
      .select()
      .single();

    if (insertError) {
      return new Response(
        JSON.stringify({ success: false, error: insertError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let extractedKeywords = null;

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
              content: `Extract 10 key concepts from this text as comma-separated keywords only: ${content.substring(0, 2000)}`
            }],
            temperature: 0.3,
            max_tokens: 100
          })
        });

        if (groqResponse.ok) {
          const groqData = await groqResponse.json();
          extractedKeywords = groqData.choices[0]?.message?.content || '';

          // FIX: Preserve existing metadata fields when updating with keywords
          await supabaseClient
            .from('memories')
            .update({
              metadata: {
                keywords: extractedKeywords,
                source: 'obsidian',
                file_path: file_path,
                model: 'llama-3.1-8b-instant'
              }
            })
            .eq('id', memory.id);
        }
      } catch (groqError) {
        console.error('Groq error:', groqError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        memory_id: memory.id,
        file_path: file_path,
        keywords_extracted: !!extractedKeywords,
        keywords: extractedKeywords
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[obsidian-sync] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
