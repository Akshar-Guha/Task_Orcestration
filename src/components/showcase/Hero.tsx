import Link from 'next/link';
import { ArrowRight, Brain, Database, Layers } from 'lucide-react';

export function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20 pb-32">
      {/* Background Effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-violet-600/20 rounded-full blur-[128px] opacity-40 animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-cyan-600/20 rounded-full blur-[128px] opacity-30 animate-pulse delay-1000" />
      </div>

      <div className="container relative z-10 px-4 text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-2 mb-8 rounded-full bg-slate-900/50 border border-slate-700/50 backdrop-blur-md animate-fade-in shadow-lg shadow-violet-500/10">
          <Brain className="w-4 h-4 text-violet-400" />
          <span className="text-sm font-medium text-slate-300">Behavioral Intelligence Platform</span>
        </div>

        {/* Headline */}
        <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight mb-8 animate-slide-up bg-clip-text text-transparent bg-gradient-to-b from-white via-slate-200 to-slate-500">
          Build Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-cyan-400">Personal AI</span><br />
          That Knows You Best
        </h1>

        {/* Subheadline */}
        <p className="text-xl md:text-2xl text-slate-400 max-w-3xl mx-auto mb-12 leading-relaxed animate-slide-up delay-100">
          A behavioral intelligence system spanning web + native Android — goal dependency DAG, sleep-productivity event log, pgvector semantic search (384-dim), and a contextual NudgeEngine with 6 behavioral triggers driven by device sensors.
          <span className="block mt-4 text-slate-300 font-medium">Designed as a production ML data pipeline: behavioral dataset export, semantic memory, and adaptive diary built for future model fine-tuning — by a data scientist, for a data scientist.</span>
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-6 animate-slide-up delay-200">
          <Link href="/dashboard" className="relative group w-full sm:w-auto">
            <div className="absolute -inset-1 bg-gradient-to-r from-violet-600 to-cyan-600 rounded-xl blur opacity-25 group-hover:opacity-75 transition duration-1000 group-hover:duration-200"></div>
            <div className="relative w-full sm:w-auto px-8 py-4 bg-white text-slate-950 rounded-xl font-bold flex items-center justify-center gap-2 transition-all hover:bg-slate-50">
              Start Your Second Brain
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>
          <a href="#how-it-works" className="w-full sm:w-auto px-8 py-4 bg-slate-900/50 border border-slate-700 text-white rounded-xl font-bold hover:bg-slate-800 hover:border-slate-600 transition-all backdrop-blur-sm">
            See Architecture
          </a>
        </div>

        {/* Statistic Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-24 max-w-4xl mx-auto text-left animate-slide-up delay-300">
          {[
            { label: "Goals Abandoned", stat: "85%", desc: "Within 6 months without a system", icon: <Layers className="w-5 h-5 text-red-400" /> },
            { label: "Data Lost", stat: "100%", desc: "Journal entries become digital landfill", icon: <Database className="w-5 h-5 text-amber-400" /> },
            { label: "Insights Gained", stat: "0", desc: "Patterns in chaos are invisible", icon: <Brain className="w-5 h-5 text-slate-400" /> },
          ].map((item, i) => (
            <div key={i} className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800/50 backdrop-blur-sm">
              <div className="flex items-center gap-3 mb-2">
                {item.icon}
                <span className="text-slate-400 font-medium text-sm">{item.label}</span>
              </div>
              <div className="text-3xl font-bold text-white mb-1">{item.stat}</div>
              <div className="text-xs text-slate-500">{item.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
