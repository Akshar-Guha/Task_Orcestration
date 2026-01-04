import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY') || '';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { file_path, file_name, content, user_id, modified_at } = await req.json();

    const { data: memory, error: insertError } = await supabaseClient
      .from('memories')
      .insert({
        user_id: user_id,
        node_id: null,
        content: content,
        created_at: modified_at || new Date().toISOString()
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
          
          await supabaseClient
            .from('memories')
            .update({ 
              metadata: { 
                keywords: extractedKeywords, 
                source: 'groq', 
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

  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
