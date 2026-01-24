import { Terminal, Shield, Trophy, BookOpen } from 'lucide-react';

export function Personas() {
  const personas = [
    {
      icon: <Terminal className="w-6 h-6 text-cyan-400" />,
      title: "The Self-Quantifier",
      who: "Tech-savvy, tracks everything, loves data",
      pain: "Data silos across apps • No pattern recognition • Export difficulties",
      solution: "Unified data model • AI correlation analysis • Obsidian sync",
      hook: "Your entire life data, unified. Patterns revealed. Progress quantified."
    },
    {
      icon: <Shield className="w-6 h-6 text-emerald-400" />,
      title: "The Privacy-Conscious",
      who: "Doesn't trust big tech, wants control",
      pain: "Data sold • AI APIs knowing secrets • SaaS Lock-in",
      solution: "100% Self-hosted • Local AI (Ollama) • You OWN the data",
      hook: "Complete privacy. Self-hosted AI. You own your data—always."
    },
    {
      icon: <Trophy className="w-6 h-6 text-amber-400" />,
      title: "The Goal-Achiever",
      who: "Has big dreams, struggles with execution",
      pain: "Abstract goals • No accountability • Tasks disconnected",
      solution: "Hierarchical goals • Streak tracking • Goal-Task Linkage",
      hook: "From vague dreams to completed milestones. Goals that actually get finished."
    },
    {
      icon: <BookOpen className="w-6 h-6 text-violet-400" />,
      title: "The Reflective Journaler",
      who: "Journaling enthusiast, wants deeper insights",
      pain: "Entries unread • No AI assistance • Insights lost",
      solution: "Semantic search • Auto-extraction • Long-term patterns",
      hook: "Your journal becomes searchable. Your past self speaks to your future self."
    }
  ];

  return (
    <section className="py-24 bg-slate-950">
      <div className="container px-4 mx-auto">
        <div className="text-center mb-16">
           <h2 className="text-3xl font-bold text-white mb-4">Who Is This For?</h2>
           <p className="text-slate-400">Designed for those who demand more from their tools.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {personas.map((p, i) => (
            <div key={i} className="group relative p-8 rounded-3xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all hover:bg-slate-800/50">
              <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform duration-500">
                {p.icon}
              </div>
              
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                  {p.icon}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">{p.title}</h3>
                  <p className="text-xs text-slate-500">{p.who}</p>
                </div>
              </div>

              <div className="space-y-4 mb-6">
                <div>
                  <div className="text-xs font-semibold text-red-400 mb-1 uppercase tracking-wider">Pain Points</div>
                  <p className="text-sm text-slate-400">{p.pain}</p>
                </div>
                <div>
                  <div className="text-xs font-semibold text-emerald-400 mb-1 uppercase tracking-wider">Solution</div>
                  <p className="text-sm text-slate-400">{p.solution}</p>
                </div>
              </div>

              <div className="pt-6 border-t border-slate-800">
                <p className="text-white italic font-medium">&quot;{p.hook}&quot;</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
