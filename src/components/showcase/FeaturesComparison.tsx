import { Check, X } from 'lucide-react';

export function FeaturesComparison() {
  const comparisonData = [
    { feature: "Goal Hierarchy with Linkage", us: true, notion: false, trad: false },
    { feature: "Sleep + Productivity Correlation", us: true, notion: false, trad: false },
    { feature: "AI 'Second Brain' Search + RAG", us: true, notion: false, trad: false },
    { feature: "Self-Hosted AI (Private)", us: true, notion: false, trad: false },
    { feature: "Obsidian Forever Sync", us: true, notion: false, trad: false },
    { feature: "One-Time Purchase", us: true, notion: false, trad: false },
  ];

  return (
    <section className="py-24 bg-slate-900/30">
      <div className="container px-4 mx-auto">
        
        {/* Comparison Chart */}
        <div className="max-w-5xl mx-auto mb-32">
          <h2 className="text-3xl font-bold text-center text-white mb-12">The Unfair Advantage</h2>
          
          <div className="rounded-3xl border border-slate-800 bg-slate-950/50 overflow-hidden backdrop-blur-sm">
            <div className="grid grid-cols-4 p-6 border-b border-slate-800 bg-slate-900/50 text-sm font-bold text-slate-300">
              <div className="col-span-1">Feature</div>
              <div className="col-span-1 text-center text-violet-400">Personal Life OS</div>
              <div className="col-span-1 text-center text-slate-500">Notion Templates</div>
              <div className="col-span-1 text-center text-slate-500">Traditional Apps</div>
            </div>
            
            {comparisonData.map((row, i) => (
              <div key={i} className="grid grid-cols-4 p-6 border-b border-slate-800/50 hover:bg-slate-900/20 transition-colors items-center">
                <div className="col-span-1 text-sm font-medium text-slate-200">{row.feature}</div>
                <div className="col-span-1 flex justify-center">
                   <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
                     <Check className="w-5 h-5 text-emerald-400" />
                   </div>
                </div>
                <div className="col-span-1 flex justify-center">
                   {row.notion ? <Check className="w-5 h-5 text-slate-400" /> : <X className="w-5 h-5 text-slate-700" />}
                </div>
                <div className="col-span-1 flex justify-center">
                   {row.trad ? <Check className="w-5 h-5 text-slate-400" /> : <X className="w-5 h-5 text-slate-700" />}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Pricing */}
      </div>
    </section>
  );
}
