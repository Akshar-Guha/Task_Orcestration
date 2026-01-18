'use client';

import { useState } from 'react';
import { SyncStatus } from '@/components/SyncStatus';

interface DbTestResult {
  success: boolean;
  connection: boolean;
  tables: Record<string, { exists: boolean; count?: number; error?: string }>;
  auth: { anonymous: boolean; userId?: string };
  rls: { enabled: boolean; canRead?: boolean; error?: string };
  error?: string;
}

export default function DatabaseSettingsPage() {
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [dbResult, setDbResult] = useState<DbTestResult | null>(null);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';

  const testConnection = async () => {
    setTesting(true);
    setStatus('idle');
    setDbResult(null);
    
    try {
      const response = await fetch('/api/debug/db-test', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      
      const data: DbTestResult = await response.json();
      setDbResult(data);
      
      if (data.success && data.connection) {
        setStatus('success');
        const tableCount = Object.values(data.tables).filter(t => t.exists).length;
        setMessage(`Connected! ${tableCount} tables accessible`);
      } else {
        setStatus('error');
        setMessage(data.error || 'Connection failed - check console for details');
      }
    } catch (error) {
      setStatus('error');
      setMessage('Network error: Could not reach server. Check if the app is deployed correctly.');
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
        <h2 className="text-xl font-bold text-white mb-2">Database Configuration</h2>
        <p className="text-sm text-slate-500">
          Supabase connection settings (managed via environment variables)
        </p>
      </div>

      {/* Connection Details */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Connection Details</h3>
        
        <div className="space-y-4">
          {/* Supabase URL */}
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-2">
              Supabase URL
            </label>
            <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700">
              <code className="text-sm text-violet-400">{supabaseUrl}</code>
            </div>
            <p className="text-xs text-slate-600 mt-1">
              Configured in NEXT_PUBLIC_SUPABASE_URL
            </p>
          </div>

          {/* Project ID */}
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-2">
              Project ID
            </label>
            <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700">
              <code className="text-sm text-cyan-400">{supabaseUrl?.split('.')[0]?.replace('https://', '') || 'Not configured'}</code>
            </div>
          </div>
        </div>
      </div>

      {/* Test Connection */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Test Connection</h3>
        
        <button
          onClick={testConnection}
          disabled={testing}
          className={`px-6 py-3 rounded-lg font-medium transition-all ${
            testing
              ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
              : 'bg-violet-600 hover:bg-violet-700 text-white'
          }`}
        >
          {testing ? 'Testing...' : 'Test Database Connection'}
        </button>

        {/* Status Message */}
        {status !== 'idle' && (
          <div
            className={`mt-4 p-4 rounded-lg border ${
              status === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400'
                : 'bg-red-500/10 border-red-500/40 text-red-400'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="text-xl">
                {status === 'success' ? '✅' : '❌'}
              </span>
              <span className="font-medium">{message}</span>
            </div>
          </div>
        )}

        {/* Table Details */}
        {dbResult && dbResult.tables && (
          <div className="mt-4 grid grid-cols-2 md:grid-cols-5 gap-2">
            {Object.entries(dbResult.tables).map(([table, info]) => (
              <div 
                key={table} 
                className={`p-3 rounded-lg text-center ${
                  info.exists 
                    ? 'bg-emerald-500/10 border border-emerald-500/30' 
                    : 'bg-red-500/10 border border-red-500/30'
                }`}
              >
                <div className="text-xs text-slate-500 mb-1">{table}</div>
                <div className={`text-sm font-mono ${info.exists ? 'text-emerald-400' : 'text-red-400'}`}>
                  {info.exists ? `${info.count || 0} rows` : 'Missing'}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sync to Obsidian */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Sync to Obsidian</h3>
        <p className="text-sm text-slate-400 mb-4">
          Push all your goals and tasks to your GitHub-synced Obsidian vault as markdown files.
        </p>
        
        <button
          onClick={async () => {
            setTesting(true);
            setStatus('idle');
            setMessage('');
            try {
              const res = await fetch('/api/obsidian/full-sync', { method: 'POST' });
              const data = await res.json();
              if (data.success) {
                setStatus('success');
                setMessage(`Synced ${data.results?.goals?.synced || 0} goals and ${data.results?.tasks?.synced || 0} tasks to Obsidian!`);
              } else {
                setStatus('error');
                setMessage(data.error || 'Sync failed');
              }
            } catch (e) {
              setStatus('error');
              setMessage('Network error: ' + String(e));
            } finally {
              setTesting(false);
            }
          }}
          disabled={testing}
          className="w-full py-3 px-4 rounded-lg font-medium transition-all bg-gradient-to-r from-violet-500 to-cyan-500 text-white hover:opacity-90 disabled:opacity-50"
        >
          {testing ? '⏳ Syncing...' : '🔄 Sync All to Obsidian'}
        </button>
      </div>

      {/* Obsidian Restore */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Restore from Obsidian</h3>
        <div className="mb-6 flex items-center justify-between p-4 bg-slate-800/50 rounded-lg border border-slate-700">
          <div>
            <div className="text-sm font-medium text-white mb-1">Sync Status</div>
            <div className="text-xs text-slate-400">Connection to GitHub vault</div>
          </div>
          <SyncStatus />
        </div>

        <p className="text-sm text-slate-400 mb-4">
          Pull data from your GitHub-synced Obsidian vault. This will overwrite local data with the content from your vault.
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={async () => {
              if (!confirm('This will overwrite all local goals. Continue?')) return;
              try {
                setStatus('idle');
                const res = await fetch('/api/obsidian/restore', {
                  method: 'POST',
                  body: JSON.stringify({ type: 'goals' }),
                });
                const data = await res.json();
                if (data.success) {
                  alert(`Restored ${data.restored} goals!`);
                  window.location.reload();
                } else {
                  alert('Restore failed: ' + data.error);
                }
              } catch (e) {
                alert('Restore failed: ' + String(e));
              }
            }}
            className="px-4 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-medium transition-all"
          >
            Restore Goals
          </button>
          
          <button
            onClick={async () => {
              if (!confirm('This will overwrite all local tasks. Continue?')) return;
              try {
                setStatus('idle');
                const res = await fetch('/api/obsidian/restore', {
                  method: 'POST',
                  body: JSON.stringify({ type: 'tasks' }),
                });
                const data = await res.json();
                if (data.success) {
                  alert(`Restored ${data.restored} tasks!`);
                  window.location.reload();
                } else {
                  alert('Restore failed: ' + data.error);
                }
              } catch (e) {
                alert('Restore failed: ' + String(e));
              }
            }}
            className="px-4 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-medium transition-all"
          >
            Restore Tasks
          </button>
          
          <button
            onClick={async () => {
              if (!confirm('FULL RESTORE: This will overwrite EVERYTHING. Are you sure?')) return;
              try {
                setStatus('idle');
                const res = await fetch('/api/obsidian/restore', { method: 'POST' });
                const data = await res.json();
                if (data.success) {
                  alert(`Full restore complete! Synced: ${data.synced}, Failed: ${data.failed}`);
                  window.location.reload();
                } else {
                  alert('Restore failed: ' + data.error);
                }
              } catch (e) {
                alert('Restore failed: ' + String(e));
              }
            }}
            className="px-4 py-3 bg-red-900/30 hover:bg-red-900/50 text-red-200 border border-red-900/50 rounded-lg font-medium transition-all"
          >
            Full Vault Restore
          </button>
        </div>
      </div>

      {/* Schema Info */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Graph Schema</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {['nodes', 'edges', 'memories', 'daily_logs', 'profiles'].map((table) => (
            <div key={table} className="p-3 bg-slate-800/50 rounded-lg text-center">
              <div className="text-xs text-slate-500 mb-1">Table</div>
              <div className="text-sm font-mono text-violet-400">{table}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
