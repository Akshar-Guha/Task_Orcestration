import { ArrowDown, X, Check, Database, Layout, FileText } from 'lucide-react';

export function ProblemSolution() {
  return (
    <section id="how-it-works" className="py-24 bg-slate-900/20">
      <div className="container px-4 mx-auto">
        {/* The Problem */}
        <div className="max-w-4xl mx-auto mb-24">
          <h2 className="text-3xl font-bold text-center text-white mb-12">The Problem: <span className="text-red-400">Disconnected Dots</span></h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="p-8 rounded-3xl bg-red-500/5 border border-red-500/10">
              <div className="flex items-start gap-4 mb-6">
                <div className="p-3 rounded-xl bg-red-500/10 text-red-400">
                  <X className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white mb-2">The Scattered Life</h3>
                  <p className="text-slate-400 leading-relaxed">
                    &quot;I have goals scattered everywhere, journal entries I never reread, task lists that don&apos;t connect to my big picture, 
                    and no idea if I&apos;m actually making progress.&quot;
                  </p>
                </div>
              </div>
              
              <div className="space-y-3">
                {[
                  "Goal trackers → Goals only (No daily execution)",
                  "Journals → Entries only (No actionability)",
                  "Task Managers → Lists only (No strategic alignment)",
                  "Sleep Apps → Data only (No productivity correlation)"
                ].map((text, i) => (
                  <div key={i} className="flex items-center gap-3 text-sm text-slate-500 bg-slate-950/30 p-3 rounded-lg">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500/50" />
                    {text}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-center p-8">
              <div className="text-center">
                <div className="text-2xl font-bold text-white mb-4">Until Now.</div>
                <div className="text-slate-400">
                  Most apps solve one problem.<br />
                  <span className="text-violet-400 font-bold">We solved the connection.</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* The Solution Diagram */}
        <div className="bg-slate-950 rounded-[40px] border border-slate-800 p-8 md:p-16 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-violet-500/10 rounded-full blur-3xl pointer-events-none" />
          
          <div className="text-center mb-16">
             <span className="px-4 py-1.5 rounded-full bg-emerald-500/10 text-emerald-400 text-sm font-medium border border-emerald-500/20">
               THE SOLUTION
             </span>
             <h2 className="text-4xl md:text-5xl font-bold text-white mt-4 mb-6">Personal Life OS</h2>
             <p className="text-slate-400 max-w-2xl mx-auto">One unified system where data flows seamlessly from high-level vision to daily action.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 relative z-10">
            {/* Input Sources */}
            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center mb-4">
                <Layout className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-white mb-2">GOALS</h3>
              <p className="text-xs text-slate-500">Yearly • Quarterly • Monthly • Weekly</p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center mb-4">
                <Check className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-white mb-2">TASKS</h3>
              <p className="text-xs text-slate-500">Time-Tracked • Daily Reset • Context Aware</p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center mb-4">
                <FileText className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-white mb-2">JOURNAL</h3>
              <p className="text-xs text-slate-500">AI-Powered • Reflection • Mood & Energy</p>
            </div>
          </div>

          <div className="flex justify-center mb-8">
             <ArrowDown className="w-8 h-8 text-slate-700 animate-bounce" />
          </div>

          {/* Unified Dashboard */}
          <div className="max-w-2xl mx-auto p-8 rounded-3xl bg-slate-900/80 border border-slate-700 backdrop-blur-xl mb-8 relative z-10 text-center shadow-2xl">
            <h3 className="text-2xl font-bold text-white mb-4">Unified Dashboard</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div className="p-2 bg-slate-950 rounded-lg text-slate-400">Semantic Search</div>
              <div className="p-2 bg-slate-950 rounded-lg text-slate-400">Behavioral Graph</div>
              <div className="p-2 bg-slate-950 rounded-lg text-slate-400">Goal DAG</div>
              <div className="p-2 bg-slate-950 rounded-lg text-slate-400">ML Export</div>
            </div>
          </div>

          <div className="flex justify-center mb-8">
             <ArrowDown className="w-8 h-8 text-slate-700 animate-bounce" />
          </div>

          {/* AI Second Brain */}
          <div className="max-w-3xl mx-auto p-1 bg-gradient-to-r from-violet-600 to-cyan-600 rounded-3xl mb-8 shadow-glow">
            <div className="bg-slate-950 rounded-[22px] p-8 text-center relative overflow-hidden">
               <div className="absolute inset-0 bg-violet-600/5 animate-pulse" />
               <h3 className="text-2xl font-bold text-white mb-2 relative z-10">AI &quot;Second Brain&quot;</h3>
               <p className="text-violet-300 mb-6 relative z-10">Semantic Search • Pattern Recognition • RAG-Based Insights</p>
               <div className="flex justify-center gap-2 relative z-10">
                 <span className="px-3 py-1 rounded-full bg-slate-900 text-xs text-slate-400 border border-slate-800">Vectors</span>
                 <span className="px-3 py-1 rounded-full bg-slate-900 text-xs text-slate-400 border border-slate-800">Embeddings</span>
                 <span className="px-3 py-1 rounded-full bg-slate-900 text-xs text-slate-400 border border-slate-800">Inference</span>
               </div>
            </div>
          </div>

          <div className="flex justify-center mb-8">
             <ArrowDown className="w-8 h-8 text-slate-700 animate-bounce" />
          </div>

          {/* Forever Storage */}
          <div className="max-w-xl mx-auto p-6 rounded-2xl bg-emerald-950/30 border border-emerald-900/50 text-center">
            <div className="flex items-center justify-center gap-3 mb-2">
              <Database className="w-5 h-5 text-emerald-400" />
              <h3 className="font-bold text-emerald-100">Forever Storage</h3>
            </div>
            <p className="text-emerald-400/60 text-sm">Obsidian Sync • Git Version Control • Human-Readable Markdown</p>
          </div>

        </div>
      </div>
    </section>
  );
}
