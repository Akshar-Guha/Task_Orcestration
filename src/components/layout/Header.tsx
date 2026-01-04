'use client';

export function Header() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-14 bg-[#0d0f17]/90 backdrop-blur-xl border-b border-white/5">
      <div className="flex items-center justify-between h-full max-w-4xl mx-auto px-4">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🎯</span>
          <h1 className="text-lg font-semibold bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">
            GoalTracker
          </h1>
        </div>
        
        <button 
          className="flex items-center justify-center w-9 h-9 rounded-full bg-slate-800/50 border border-white/10 text-slate-400 hover:text-white hover:bg-slate-700/50 transition-all"
          aria-label="User menu"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="8" r="4" />
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          </svg>
        </button>
      </div>
    </header>
  );
}
