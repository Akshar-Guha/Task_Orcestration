'use client';

import { useState } from 'react';

export default function DatabaseSettingsPage() {
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';

  const testConnection = async () => {
    setTesting(true);
    setStatus('idle');
    
    try {
      const response = await fetch('/api/config/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      
      const data = await response.json();
      
      if (data.success) {
        setStatus('success');
        setMessage('Successfully connected to Supabase!');
      } else {
        setStatus('error');
        setMessage(data.message || 'Connection failed');
      }
    } catch (error) {
      setStatus('error');
      setMessage('Network error: Could not reach server');
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
