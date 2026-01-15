import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function runMigration() {
  console.log('[Migration] Reading SQL file...');
  const sqlPath = path.join(__dirname, 'supabase', 'migrations', '20250115_initial_schema.sql');
  const sql = fs.readFileSync(sqlPath, 'utf-8');
  
  console.log('[Migration] Executing schema creation...');
  
  // Split SQL into individual statements (simple split by semicolon)
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));
  
  for (const [index, statement] of statements.entries()) {
    console.log(`[Migration] Executing statement ${index + 1}/${statements.length}...`);
    
    try {
      const { data, error } = await supabase.rpc('exec', { sql: statement + ';' });
      
      if (error) {
        // Try direct query for CREATE/ALTER statements
        const { error: directError } = await supabase.from('_migrations').select().limit(0);
        
        if (directError && !directError.message.includes('does not exist')) {
          console.error(`[Migration] Error on statement ${index + 1}:`, error);
        }
      } else {
        console.log(`✓ Statement ${index + 1} executed`);
      }
    } catch (err) {
      console.error(`[Migration] Unexpected error on statement ${index + 1}:`, err);
    }
  }
  
  console.log('\n[Migration] Complete! Verifying tables...');
  
  // Verify tables exist
  const tables = ['goals','tasks', 'time_slots', 'productivity_logs', 'sleep_wake_logs'];
  
  for (const table of tables) {
    const { data, error } = await supabase.from(table).select('id').limit(1);
    if (error) {
      console.error(`✗ Table '${table}' check failed:`, error.message);
    } else {
      console.log(`✓ Table '${table}' exists and is accessible`);
    }
  }
  
  console.log('\n[Migration] Done!');
}

runMigration().catch(console.error);
