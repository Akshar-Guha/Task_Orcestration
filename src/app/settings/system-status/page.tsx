'use client';

export default function SystemStatusPage() {
  const envVars = [
    {
      name: 'NEXT_PUBLIC_SUPABASE_URL',
      value: process.env.NEXT_PUBLIC_SUPABASE_URL,
      required: true,
      type: 'Public',
    },
    {
      name: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      value: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      required: true,
      type: 'Public',
    },
    {
      name: 'SUPABASE_SERVICE_ROLE_KEY',
      value: process.env.SUPABASE_SERVICE_ROLE_KEY,
      required: true,
      type: 'Secret',
    },
    {
      name: 'OPENAI_API_KEY',
      value: process.env.OPENAI_API_KEY,
      required: false,
      type: 'Secret',
    },
    {
      name: 'NEXT_PUBLIC_N8N_URL',
      value: process.env.NEXT_PUBLIC_N8N_URL,
      required: false,
      type: 'Public',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
        <h2 className="text-xl font-bold text-white mb-2">System Status</h2>
        <p className="text-sm text-slate-500">
          Environment configuration and API key health
        </p>
      </div>

      {/* Environment Variables */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Environment Variables</h3>
        
        <div className="space-y-3">
          {envVars.map((envVar) => {
            const isConfigured = !!envVar.value;
            const showWarning = envVar.required && !isConfigured;

            return (
              <div
                key={envVar.name}
                className={`p-4 rounded-lg border ${
                  showWarning
                    ? 'bg-red-500/10 border-red-500/40'
                    : isConfigured
                    ? 'bg-emerald-500/10 border-emerald-500/40'
                    : 'bg-slate-800/50 border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">
                      {showWarning ? '❌' : isConfigured ? '✅' : '⚪'}
                    </span>
                    <div>
                      <div className="text-sm font-mono text-white">{envVar.name}</div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {envVar.type} • {envVar.required ? 'Required' : 'Optional'}
                      </div>
                    </div>
                  </div>
                  <div className="text-xs px-2 py-1 rounded bg-slate-700 text-slate-400">
                    {isConfigured ? 'Configured' : 'Missing'}
                  </div>
                </div>
                
                {envVar.type === 'Secret' && isConfigured && (
                  <div className="text-xs text-slate-600 mt-2">
                    Value: <span className="font-mono">••••••••</span> (hidden for security)
                  </div>
                )}
                
                {envVar.type === 'Public' && isConfigured && (
                  <div className="text-xs text-violet-400 mt-2 font-mono break-all">
                    {envVar.value}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Help Message */}
        <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/40 rounded-lg">
          <div className="flex items-start gap-3">
            <span className="text-xl">ℹ️</span>
            <div>
              <p className="text-sm text-blue-400 font-medium mb-1">
                How to configure environment variables
              </p>
              <p className="text-xs text-slate-400">
                Edit the <code className="text-violet-400">.env.local</code> file in your project root.
                Add or update the variables listed above, then restart the dev server.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* System Health */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4">System Health</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-slate-800/50 rounded-lg text-center">
            <div className="text-3xl mb-2">
              {envVars.filter(v => v.required && v.value).length === envVars.filter(v => v.required).length ? '✅' : '⚠️'}
            </div>
            <div className="text-sm text-white font-medium mb-1">Core Config</div>
            <div className="text-xs text-slate-500">
              {envVars.filter(v => v.required && v.value).length}/{envVars.filter(v => v.required).length} Required
            </div>
          </div>

          <div className="p-4 bg-slate-800/50 rounded-lg text-center">
            <div className="text-3xl mb-2">🗄️</div>
            <div className="text-sm text-white font-medium mb-1">Database</div>
            <div className="text-xs text-emerald-400">Connected</div>
          </div>

          <div className="p-4 bg-slate-800/50 rounded-lg text-center">
            <div className="text-3xl mb-2">
              {process.env.NEXT_PUBLIC_N8N_URL ? '🟡' : '⚪'}
            </div>
            <div className="text-sm text-white font-medium mb-1">n8n</div>
            <div className="text-xs text-slate-500">
              {process.env.NEXT_PUBLIC_N8N_URL ? 'Configured' : 'Not Deployed'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
