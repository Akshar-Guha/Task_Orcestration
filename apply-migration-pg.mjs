import pg from 'pg';
import dotenv from 'dotenv';
import * as fs from 'fs';

// Load .env.local
dotenv.config({ path: '.env.local' });

const { Client } = pg;

// Construct connection string from Supabase URL and service key
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const projectRef = supabaseUrl.match(/https:\/\/([^.]+)/)[1];

//  Supabase connection string format:
// postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
const connectionString = `postgresql://postgres.${projectRef}:${process.env.SUPABASE_SERVICE_ROLE_KEY}@aws-0-us-west-1.pooler.supabase.com:6543/postgres`;

console.log('[PG Migration] Connecting to Supabase via PostgreSQL...');
console.log('[PG Migration] Project Ref:', projectRef);

const client = new Client({
  connectionString,
  ssl: {
    rejectUnauthorized: false
  }
});

async function runMigration() {
  try {
    await client.connect();
    console.log('[PG Migration] ✓ Connected to database\n');
    
    // Read migration file
    const sql = fs.readFileSync('supabase/migrations/20250117_fix_rls_policies.sql', 'utf-8');
    
    console.log('[PG Migration] Executing SQL:\n');
    console.log(sql);
    console.log('\n---\n');
    
    // Execute the full SQL
    await client.query(sql);
    
    console.log('\n[PG Migration] ✓ Migration executed successfully!\n');
    
    // Verify policies were created
    const { rows: policies } = await client.query(`
      SELECT tablename, policyname
      FROM pg_policies
      WHERE schemaname = 'public'
      AND policyname LIKE '%Fallback%'
      ORDER BY tablename;
    `);
    
    console.log('[PG Migration] RLS Policies created:');
    policies.forEach(p => {
      console.log(`  ✓ ${p.tablename}: ${p.policyname}`);
    });
    
  } catch (err) {
    console.error('\n[PG Migration] ✗ Migration failed:', err.message);
    console.error('\nFull error:', err);
  } finally {
    await client.end();
    console.log('\n[PG Migration] Connection closed');
  }
}

runMigration();
