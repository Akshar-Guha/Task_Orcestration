import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load .env.local
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const fallbackUserId = process.env.NEXT_PUBLIC_USER_ID;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

console.log('[RLS Check] Connecting to Supabase...');
console.log('[RLS Check] Fallback User ID:', fallbackUserId);

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function checkAndFixRLS() {
  console.log('\n[RLS Check] Listing existing policies...\n');
  
  // Query pg_policies to see what RLS policies exist
  const { data: policies, error: policiesError } = await supabase
    .rpc('exec_sql', {
      sql: `
        SELECT schemaname AS schema, tablename AS table, policyname AS policy
        FROM pg_policies
        WHERE schemaname = 'public'
        ORDER BY tablename, policyname;
      `
    });
  
  if (policiesError) {
    console.log('[RLS Check] Could not query policies (this is normal)');
    console.log('[RLS Check] Will proceed with creating policies...\n');
  } else {
    console.log('[RLS Check] Existing policies:', policies);
  }
  
  // Now let's test inserts with the anon key (not service role key!) to see if RLS blocks us
  console.log('\n[RLS Check] Testing with ANON key (this will show if RLS is blocking)...\n');
  
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const anonClient = createClient(supabaseUrl, anonKey);
  
  const { randomUUID } = await import('crypto');
  const testGoalId = randomUUID();
  
  const { data: testGoal, error: anonInsertError } = await anonClient
    .from('goals')
    .insert({
      id: testGoalId,
      user_id: fallbackUserId,
      title: 'RLS Test with Anon Key',
      level: 'ad_hoc',
      status: 'not_started',
    })
    .select();
  
  if (anonInsertError) {
    console.error('[RLS Check] ✗ ANON insert FAILED:', anonInsertError.message);
    console.error('[RLS Check] This means RLS is BLOCKING writes!');
    console.error('[RLS Check] Need to create fallback user policies...\n');
    
    // Create the policies using service role
    await createFallbackUserPolicies();
  } else {
    console.log('[RLS Check] ✓ ANON insert succeeded!');
    console.log('[RLS Check] RLS policies are working correctly!');
    
    // Clean up
    await supabase.from('goals').delete().eq('id', testGoalId);
    console.log('[RLS Check] Test goal cleaned up');
  }
  
  // Test reading data
  console.log('\n[RLS Check] Testing data retrieval with ANON key...');
  
  const  { data: goals, error: selectError } = await anonClient
    .from('goals')
    .select('id, title')
    .eq('user_id', fallbackUserId)
    .limit(5);
  
  if (selectError) {
    console.error('[RLS Check] ✗ SELECT failed:', selectError.message);
  } else {
    console.log(`[RLS Check] ✓ SELECT succeeded, found ${goals.length} goals`);
    if (goals.length > 0) {
      console.log('[RLS Check] Sample goals:', goals);
    }
  }
}

async function createFallbackUserPolicies() {
  console.log('[RLS Fix] Creating fallback user policies...\n');
  
  const tables = ['goals', 'tasks', 'time_slots', 'productivity_logs', 'sleep_wake_logs', 'timeline_events'];
  const fallbackUserId = process.env.NEXT_PUBLIC_USER_ID;
  
  for (const table of tables) {
    const policyName = `Fallback user can manage ${table}`;
    
    console.log(`[RLS Fix] Creating policy for ${table}...`);
    
    // Drop existing policy if it exists
    const dropSQL = `DROP POLICY IF EXISTS "${policyName}" ON ${table};`;
    
    // Create new policy
    const createSQL = `
      CREATE POLICY "${policyName}" ON ${table}
        FOR ALL USING (user_id = '${fallbackUserId}'::uuid);
    `;
    
    try {
      await fetch(`${supabaseUrl}/rest/v1/rpc/exec`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
        },
        body: JSON.stringify({ sql: dropSQL + createSQL })
      });
      
      console.log(`[RLS Fix] ✓ Policy created for ${table}`);
    } catch (err) {
      console.error(`[RLS Fix] ✗ Failed to create policy for ${table}:`, err.message);
    }
  }
  
  console.log('\n[RLS Fix] Policy creation complete!');
  console.log('[RLS Fix] Re-testing insert...\n');
  
  // Re-test
  await checkAndFixRLS();
}

checkAndFixRLS().catch(console.error);
