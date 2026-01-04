'use client';

export default function SettingsPage() {
  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-8 text-center">
      <div className="text-6xl mb-4">⚙️</div>
      <h2 className="text-2xl font-bold text-white mb-3">Welcome to Settings</h2>
      <p className="text-slate-400 mb-6">
        Select a tab above to configure your system
      </p>
      <div className="grid grid-cols-2 gap-4 max-w-md mx-auto">
        <a
          href="/settings/database"
          className="p-4 bg-slate-800/50 rounded-lg hover:bg-slate-700 transition-all"
        >
          <div className="text-2xl mb-2">🗄️</div>
          <div className="text-sm text-white font-medium">Database</div>
        </a>
        <a
          href="/settings/agent-mode"
          className="p-4 bg-slate-800/50 rounded-lg hover:bg-slate-700 transition-all"
        >
          <div className="text-2xl mb-2">🤖</div>
          <div className="text-sm text-white font-medium">Agent Mode</div>
        </a>
      </div>
    </div>
  );
}
