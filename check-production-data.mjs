import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Hardcode from .env.local
const supabaseUrl = 'https://vcbzzpxovqetxybpkrzo.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZjYnp6cHhvdnFldHh5YnBrcnpvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzEwNzc0MSwiZXhwIjoyMDgyNjgzNzQxfQ.4MQgM63XQFpsS_5zkry2UkP-rFVUtdsIB3UZrFNV5p4';
const userId = '2c32a446-1bbc-4294-8a29-3e4fef5649e6';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function checkProductionData() {
  const report = [];
  
  report.push('==============================================');
  report.push('PRODUCTION DATABASE CHECK');
  report.push('==============================================');
  report.push(`User ID: ${userId}`);
  report.push(`Checking tables at: ${new Date().toISOString()}`);
  report.push('');
  
  const tables = ['goals', 'tasks', 'time_slots', 'productivity_logs', 'sleep_wake_logs'];
  
  for (const table of tables) {
    const { data, error, count } = await supabase
      .from(table)
      .select('*', { count: 'exact' })
      .eq('user_id', userId);
    
    if (error) {
      report.push(`ERROR ${table}: ${error.message}`);
    } else {
      report.push(`Table: ${table} - ${count || 0} records`);
      if (data && data.length > 0 && data.length <= 5) {
        report.push(`  Data: ${JSON.stringify(data, null, 2)}`);
      } else if (data && data.length > 5) {
        report.push(`  First 3 records:`);
        data.slice(0, 3).forEach((item, idx) => {
          report.push(`   ${idx + 1}. ${JSON.stringify(item).substring(0, 100)}...`);
        });
      }
    }
    report.push('');
  }
  
  report.push('==============================================');
  report.push('CHECK COMPLETE');
  report.push('==============================================');
  
  const output = report.join('\n');
  console.log(output);
  
  fs.writeFileSync('data-check-report.txt', output, 'utf-8');
  console.log('\nReport saved to: data-check-report.txt');
}

checkProductionData().catch(console.error);
