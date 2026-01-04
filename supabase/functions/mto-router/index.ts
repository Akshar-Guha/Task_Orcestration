import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { corsHeaders } from "../_shared/cors.ts"

console.log("Hello from mto-router (v8)!")

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { action, data } = await req.json()
    console.log(`Received action: ${action}`, data)

    let result;

    switch (action) {
      case 'test':
        result = { success: true, message: "Backend is online" }
        break;

      case 'create_memory':
        const { content, embedding, user_id: memUserId, metadata: memMeta } = data;
        if (!content || !embedding) throw new Error("Missing content or embedding for memory");

        const { data: memory, error: memError } = await supabase
          .from('memories')
          .insert({
            user_id: memUserId,
            content,
            metadata: memMeta || {},
            embedding
          })
          .select()
          .single()

        if (memError) throw memError;
        result = { success: true, memory };
        break;

      case 'search_memories':
         const { query_embedding, match_threshold = 0.5, match_count = 5 } = data;
         if (!query_embedding) throw new Error("Missing query_embedding");

         const { data: matches, error: searchError } = await supabase
           .rpc('match_memories', {
             query_embedding,
             match_threshold,
             match_count
           });
        
         if (searchError) throw searchError;
         result = { success: true, matches };
         break;

      case 'create_node':
        // Expecting data to contain: id, type, title, etc.
        const { id, type, title, description, properties, metadata, user_id } = data
        
        // Basic validation
        if (!type || !title) throw new Error("Missing required fields: type, title");

        const nodeData = {
          id: id, // Explicitly use provided ID (UUIDv4)
          type,
          title,
          description,
          properties: properties || {},
          metadata: metadata || {},
          user_id: user_id, 
          updated_at: new Date().toISOString()
        }

        // Perform UPSERT
        const { data: node, error: nodeError } = await supabase
          .from('nodes')
          .upsert(nodeData)
          .select()
          .single()

        if (nodeError) throw nodeError
        result = { success: true, node }
        break;

      case 'update_node':
         const { id: updateId, ...updates } = data;
         if (!updateId) throw new Error("Missing node ID for update");

         const { data: updatedNode, error: updateError } = await supabase
            .from('nodes')
            .update({
                ...updates,
                updated_at: new Date().toISOString()
            })
            .eq('id', updateId)
            .select()
            .single();

         if (updateError) throw updateError;
         result = { success: true, node: updatedNode };
         break;

      case 'delete_node':
          const { id: deleteId } = data;
          if (!deleteId) throw new Error("Missing node ID for deletion");

          const { error: deleteError } = await supabase
              .from('nodes')
              .delete()
              .eq('id', deleteId);

          if (deleteError) throw deleteError;
          result = { success: true };
          break;

      case 'create_edge':
        const { source_id, target_id, relation_type, properties: edgeProps, id: edgeId } = data
        
        const edgeData = {
            id: edgeId, // Optional explicit ID
            source_id,
            target_id,
            relation_type,
            properties: edgeProps || {}
        }

        const { data: edge, error: edgeError } = await supabase
          .from('edges')
          .insert(edgeData)
          .select()
          .single()

        if (edgeError) throw edgeError
        result = { success: true, edge }
        break;
        
      case 'delete_edge':
          const { id: deleteEdgeId } = data;
          if (!deleteEdgeId) throw new Error("Missing edge ID");
          
          const { error: delEdgeError } = await supabase
            .from('edges')
            .delete()
            .eq('id', deleteEdgeId);
            
          if (delEdgeError) throw delEdgeError;
          result = { success: true };
          break;

      case 'create_event':
        const { id: eventId, event_type, goal_id, task_id, details, user_id: eventUserId } = data
        
        const eventData = {
          id: eventId, // Optional explicit ID
          user_id: eventUserId,
          event_type,
          goal_id: goal_id || null, // Handle undefined
          task_id: task_id || null, // Handle undefined
          details: details || {}
        }

        const { data: newEvent, error: eventError } = await supabase
          .from('timeline_events')
          .insert(eventData)
          .select()
          .single()

        if (eventError) throw eventError
        result = { success: true, event: newEvent }
        break;

      case 'get_events':
        const {limit = 50} = data || {};
        const { data: events, error: getEventsError } = await supabase
          .from('timeline_events')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(limit)

        if (getEventsError) throw getEventsError
        result = { success: true, events }
        break;

      case 'get_nodes':
        // Retrieve all nodes (filtering logic can be added here)
        const { data: allNodes, error: getError } = await supabase
          .from('nodes')
          .select('*')
          .eq('is_archived', false) // Default filter
          .order('created_at', { ascending: true })

        if (getError) throw getError
        result = { success: true, nodes: allNodes }
        break;
        
      case 'get_all':
        // Fetch nodes and edges in parallel
        const [nodesRes, edgesRes] = await Promise.all([
            supabase.from('nodes').select('*').eq('is_archived', false),
            supabase.from('edges').select('*')
        ]);
        
        if (nodesRes.error) throw nodesRes.error;
        if (edgesRes.error) throw edgesRes.error;
        
        result = { 
            success: true, 
            nodes: nodesRes.data,
            edges: edgesRes.data 
        }
        break;

      default:
        throw new Error(`Unknown action: ${action}`)
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error(error)
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
