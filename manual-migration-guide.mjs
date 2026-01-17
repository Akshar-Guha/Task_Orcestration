import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import * as fs from 'fs';

// Load .env.local
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const fallbackUserId = process.env.NEXT_PUBLIC_USER_ID;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

console.log('[Direct SQL] Connecting to Supabase...');
console.log('[Direct SQL] Fallback User ID:', fallbackUserId);

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  },
  db: {
    schema: 'public',
  },
});

async function executeDirectSQL() {
  // Read the migration file
  const sql = fs.readFileSync('supabase/migrations/20250117_fix_rls_policies.sql', 'utf-8');
  
  console.log('\n[Direct SQL] Executing migration SQL directly...\n');
  console.log(sql);
  console.log('\n---\n');
  
  // Split into individual policy creation statements
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--') && s.toUpperCase().includes('CREATE'));
  
  console.log(`[Direct SQL] Found ${statements.length} CREATE statements\n`);
  
  for (const [index, statement] of statements.entries()) {
    console.log(`\n[${index + 1}/${statements.length}] Executing:`);
    console.log(statement.substring(0, 80) + '...\n');
    
    try {
      // Use from().single() with a raw SQL query
      // This is a workaround since Supabase client doesn't expose raw SQL execution
      const { error } = await supabase.rpc('exec', { query: statement + ';' });
      
      if (error) {
        //Try alternative: Just insert it
        console.log('RPC failed, trying via POST to SQL editor endpoint...');
        
        // Use Supabase's SQL Editor API endpoint directly
        const apiUrl = supabaseUrl.replace('.supabase.co', '.supabase.co');
        const projectRef = supabaseUrl.match(/https:\/\/([^.]+)/)[1];
        
        // Execute via  Postgres connection string would be better, but let's use client
        // The issue is: we can't execute DDL via REST API
        // We need to use the SQL Editor API or pg connection
        
        console.log(`Statement ${index + 1} - Cannot execute DDL via REST API`);
        console.log(`You need to run this manually in Supabase SQL Editor:`);
        console.log(`${statement};`);
        console.log('---');
      } else {
        console.log(`✓ Statement ${index + 1} executed successfully`);
      }
    } catch (err) {
      console.error(`✗ Statement ${index + 1} failed:`, err.message);
    }
  }
  
  console.log('\n\n=== MANUAL STEPS REQUIRED ===\n');
  console.log('The Supabase JS client cannot execute DDL (CREATE POLICY) statements.');
  console.log('Please manually run the following SQL in your Supabase SQL Editor:\n');
  console.log('Dashboard URL:', `https://supabase.com/dashboard/project/${supabaseUrl.match(/https:\/\/([^.]+)/)[1]}/sql`);
  console.log('\nSQL to run:\n');
  console.log(sql);
  console.log('\n=== END MANUAL STEPS ===\n');
}

executeDirectSQL().catch(console.error);
