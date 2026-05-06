import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { corsHeaders } from "../_shared/cors.ts"

console.log("Obsidian Webhook Handler Started")

const EMBEDDING_MODEL = Deno.env.get('SUPABASE_MEMORY_EMBEDDING_MODEL') || 'Supabase/gte-small'

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
    })

    if (!response.ok) return null
    return await response.json()
  } catch {
    return null
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabase = createClient(supabaseUrl, serviceRoleKey)

    const payload = await req.json()
    console.log('Received webhook:', payload.repository?.full_name, 'ref:', payload.ref)

    if (!payload.ref?.endsWith('/main') && !payload.ref?.endsWith('/master')) {
      return new Response(JSON.stringify({ message: 'Ignored: not main branch' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    const commits = payload.commits || []
    const mdFiles = new Set<string>()
    for (const commit of commits) {
      const added = commit.added || []
      const modified = commit.modified || []
      for (const file of [...added, ...modified]) {
        if (file.endsWith('.md')) mdFiles.add(file)
      }
    }

    const results = []
    for (const filePath of mdFiles) {
      try {
        const rawUrl = `https://raw.githubusercontent.com/${payload.repository.full_name}/${payload.after}/${filePath}`
        const response = await fetch(rawUrl)

        if (!response.ok) {
          console.error(`Failed to fetch ${filePath}: ${response.status}`)
          continue
        }

        const content = await response.text()
        const fileName = filePath.split('/').pop()?.replace('.md', '') || 'Untitled'
        const firstHeading = content.match(/^#\s+(.+)$/m)
        const title = firstHeading ? firstHeading[1] : fileName
        const noteContent = `Note: ${title}\n\n${content}`
        const embedding = await generateEmbedding(supabaseUrl, serviceRoleKey, noteContent)

        const { data: memory, error } = await supabase
          .from('memories')
          .upsert({
            content: noteContent,
            metadata: {
              type: 'note',
              source: 'obsidian',
              file_path: filePath,
              repository: payload.repository.full_name,
              commit_sha: payload.after,
              synced_at: new Date().toISOString(),
            },
            file_path: filePath,
            file_name: `${fileName}.md`,
            modified_at: new Date().toISOString(),
            embedding,
            embedding_model: embedding ? EMBEDDING_MODEL : null,
            user_id: Deno.env.get('DEFAULT_USER_ID'),
          }, {
            onConflict: 'user_id,file_path',
            ignoreDuplicates: false,
          })
          .select()
          .single()

        if (error) {
          console.error(`Error storing ${filePath}:`, error)
          results.push({ file: filePath, status: 'error', error: error.message })
        } else {
          results.push({ file: filePath, status: 'success', id: memory.id, embedded: embedding != null })
        }
      } catch (err) {
        console.error(`Exception processing ${filePath}:`, err)
        results.push({ file: filePath, status: 'error', error: String(err) })
      }
    }

    return new Response(JSON.stringify({
      success: true,
      processed: mdFiles.size,
      results,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error('Webhook error:', error)
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
