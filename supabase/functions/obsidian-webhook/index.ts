import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { corsHeaders } from "../_shared/cors.ts"

console.log("Obsidian Webhook Handler Started")

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get GitHub webhook payload
    const payload = await req.json()
    console.log('Received webhook:', payload.repository?.full_name, 'ref:', payload.ref)

    // Only process pushes to main/master branch
    if (!payload.ref?.endsWith('/main') && !payload.ref?.endsWith('/master')) {
      return new Response(JSON.stringify({ message: 'Ignored: not main branch' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    const commits = payload.commits || []
    const mdFiles = new Set<string>()

    // Collect all .md files from commits
    for (const commit of commits) {
      const added = commit.added || []
      const modified = commit.modified || []
      const allFiles = [...added, ...modified]
      
      for (const file of allFiles) {
        if (file.endsWith('.md')) {
          mdFiles.add(file)
        }
      }
    }

    console.log(`Found ${mdFiles.size} markdown files to process`)

    // Process each markdown file
    const results = []
    for (const filePath of mdFiles) {
      try {
        // Fetch file content from GitHub
        const rawUrl = `https://raw.githubusercontent.com/${payload.repository.full_name}/${payload.after}/${filePath}`
        const response = await fetch(rawUrl)
        
        if (!response.ok) {
          console.error(`Failed to fetch ${filePath}: ${response.status}`)
          continue
        }

        const content = await response.text()
        
        // Extract title from filename or first heading
        const fileName = filePath.split('/').pop()?.replace('.md', '') || 'Untitled'
        const firstHeading = content.match(/^#\s+(.+)$/m)
        const title = firstHeading ? firstHeading[1] : fileName

        // Store in memories table (without embedding - will be processed client-side)
        const { data: memory, error } = await supabase
          .from('memories')
          .upsert({
            content: `Note: ${title}\n\n${content}`,
            metadata: {
              type: 'note',
              source: 'obsidian',
              file_path: filePath,
              repository: payload.repository.full_name,
              commit_sha: payload.after,
              synced_at: new Date().toISOString()
            },
            embedding: null, // Will be processed later by frontend
            user_id: Deno.env.get('DEFAULT_USER_ID') // Use configured default user
          }, {
            onConflict: 'content',
            ignoreDuplicates: false
          })
          .select()
          .single()

        if (error) {
          console.error(`Error storing ${filePath}:`, error)
          results.push({ file: filePath, status: 'error', error: error.message })
        } else {
          console.log(`Stored memory for ${filePath}`)
          results.push({ file: filePath, status: 'success', id: memory.id })
        }
      } catch (err) {
        console.error(`Exception processing ${filePath}:`, err)
        results.push({ file: filePath, status: 'error', error: String(err) })
      }
    }

    return new Response(JSON.stringify({
      success: true,
      processed: mdFiles.size,
      results
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error('Webhook error:', error)
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
