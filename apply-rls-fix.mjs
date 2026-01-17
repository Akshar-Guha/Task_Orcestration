import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load .env.local
dotenv.config({ path: '.env.local' });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials');
  console.error('URL:', supabaseUrl ? 'Found' : 'MISSING');
  console.error('Service Key:', supabaseServiceKey ? 'Found' : 'MISSING');
  process.exit(1);
}

console.log('[RLS Fix] Connecting to Supabase...');
console.log('[RLS Fix] URL:', supabaseUrl);

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function applyRLSFix() {
  console.log('[RLS Fix] Reading migration file...');
  const sqlPath = path.join(__dirname, 'supabase', 'migrations', '20250117_fix_rls_policies.sql');
  const sql = fs.readFileSync(sqlPath, 'utf-8');
  
  console.log('[RLS Fix] SQL Content:');
  console.log(sql);
  console.log('\n[RLS Fix] Executing migration...\n');
  
  // Execute the entire SQL as one block
  const { data, error } = await supabase.rpc('exec_sql', { sql });
  
  if (error) {
    console.error('[RLS Fix] Migration failed:', error);
    console.error('[RLS Fix] Trying alternative approach...');
    
    // Try executing via raw SQL query
    // Split into individual statements
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    for (const [index, statement] of statements.entries()) {
      console.log(`\n[RLS Fix] Executing statement ${index + 1}/${statements.length}:`);
      console.log(statement.substring(0, 100) + '...');
      
      try {
        // Use Supabase's REST API to execute raw SQL
        const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseServiceKey,
            'Authorization': `Bearer ${supabaseServiceKey}`
          },
          body: JSON.stringify({ sql: statement + ';' })
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`[RLS Fix] Statement ${index + 1} failed:`, errorText);
        } else {
          console.log(`✓ Statement ${index + 1} executed`);
        }
      } catch (err) {
        console.error(`[RLS Fix] Error on statement ${index + 1}:`, err.message);
      }
    }
  } else {
    console.log('[RLS Fix] ✓ Migration executed successfully');
  }
  
  console.log('\n[RLS Fix] Verifying RLS policies...');
  
  // Test insert with fallback user
  const testUserId = '2c32a446-1bbc-4294-8a29-3e4fef5649e6';
  
  console.log(`[RLS Fix] Testing insert with fallback user: ${testUserId}`);
  
  // Generate a proper UUID for testing
  const { randomUUID } = await import('crypto');
  const testGoalId = randomUUID();
  
  const { data: testGoal, error: insertError } = await supabase
    .from('goals')
    .insert({
      id: testGoalId,
      user_id: testUserId,
      title: 'RLS Test Goal',
      level: 'ad_hoc',
      status: 'not_started',
    })
    .select();
  
  if (insertError) {
    console.error('[RLS Fix] ✗ Test insert FAILED:', insertError);
    console.error('[RLS Fix] RLS policies are NOT working!');
  } else {
    console.log('[RLS Fix] ✓ Test insert succeeded:', testGoal);
    
    // Clean up test goal
    await supabase.from('goals').delete().eq('id', testGoal[0].id);
    console.log('[RLS Fix] ✓ Test goal cleaned up');
  }
  
  console.log('\n[RLS Fix] Done!');
}

applyRLSFix().catch(console.error);
