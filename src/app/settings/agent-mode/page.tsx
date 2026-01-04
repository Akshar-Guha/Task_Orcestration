'use client';

import { useState } from 'react';
import { testBackendConnection, getNodes } from '@/lib/backend';

export default function AgentModePage() {
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [nodeCount, setNodeCount] = useState<number | null>(null);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const edgeFunctionUrl = `${supabaseUrl}/functions/v1/mto-router`;

  const testConnection = async () => {
    setTesting(true);
    setStatus('idle');
    
    try {
      const isConnected = await testBackendConnection();
      if (isConnected) {
        setStatus('success');
        // Also fetch node count
        const nodesResult = await getNodes();
        if (nodesResult.success && nodesResult.nodes) {
          setNodeCount(nodesResult.nodes.length);
        }
      } else {
        setStatus('error');
      }
    } catch {
      setStatus('error');
    } finally {
      setTesting(false);
    }
  };

  const actions = [
    { name: 'Test Connection', action: 'test', description: 'Verify backend is responding' },
    { name: 'Create Node', action: 'create_node', description: 'Add a new node to the graph' },
    { name: 'Create Memory', action: 'create_memory', description: 'Store a new memory entry' },
    { name: 'Create Edge', action: 'create_edge', description: 'Connect two nodes' },
    { name: 'Get Nodes', action: 'get_nodes', description: 'Retrieve all nodes' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
        <h2 className="text-xl font-bold text-white mb-2">Backend Configuration</h2>
        <p className="text-sm text-slate-500">
          Supabase Edge Function API for MTO operations
        </p>
      </div>

      {/* Edge Function Status */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Edge Function</h3>
          <span className={`text-xs px-3 py-1 rounded-full ${
            status === 'success' 
              ? 'bg-green-500/20 text-green-400 border border-green-500/40'
              : status === 'error'
              ? 'bg-red-500/20 text-red-400 border border-red-500/40'
              : 'bg-slate-700 text-slate-400'
          }`}>
            {status === 'success' ? '✓ Connected' : status === 'error' ? '✗ Failed' : 'Not tested'}
          </span>
        </div>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-2">
              Function Name
            </label>
            <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700">
              <code className="text-sm text-violet-400">mto-router</code>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-400 mb-2">
              Endpoint URL
            </label>
            <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700 overflow-x-auto">
              <code className="text-sm text-cyan-400 whitespace-nowrap">{edgeFunctionUrl}</code>
            </div>
          </div>

          {nodeCount !== null && (
            <div className="p-3 bg-green-500/10 rounded-lg border border-green-500/30">
              <span className="text-green-400">
                📊 Database Status: <strong>{nodeCount}</strong> nodes in database
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Available Actions */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Available Actions</h3>
        
        <div className="space-y-3">
          {actions.map((action) => (
            <div
              key={action.action}
              className="p-4 bg-slate-800/50 rounded-lg border border-slate-700"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-white">{action.name}</span>
                <code className="text-xs px-2 py-1 rounded bg-violet-600/20 text-violet-400 border border-violet-500/30">
                  {action.action}
                </code>
              </div>
              <p className="text-xs text-slate-500">{action.description}</p>
            </div>
          ))}
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
          {testing ? 'Testing...' : 'Test Backend Connection'}
        </button>

        {status === 'success' && (
          <div className="mt-4 p-4 rounded-lg border bg-green-500/10 border-green-500/40 text-green-400">
            <div className="flex items-center gap-2">
              <span className="text-xl">✅</span>
              <span className="font-medium">Backend is working! Edge Function responded successfully.</span>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="mt-4 p-4 rounded-lg border bg-red-500/10 border-red-500/40 text-red-400">
            <div className="flex items-center gap-2">
              <span className="text-xl">❌</span>
              <span className="font-medium">Connection failed. Check Supabase Edge Function logs.</span>
            </div>
          </div>
        )}
      </div>

      {/* Quick Reference */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4">API Usage</h3>
        <pre className="p-4 bg-slate-800 rounded-lg overflow-x-auto text-sm">
          <code className="text-slate-300">{`// Example: Create a new node
const response = await fetch('${edgeFunctionUrl}', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action: 'create_node',
    data: {
      type: 'task',
      title: 'My Task',
      description: 'Task description'
    }
  })
});`}</code>
        </pre>
      </div>
    </div>
  );
}
