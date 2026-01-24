import Link from 'next/link';
import { ArrowRight, Sparkles, Zap, Shield, Brain } from 'lucide-react';

export function Hero() {
  return (
    <div className="relative min-h-[90vh] flex items-center justify-center overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-violet-600/20 rounded-full blur-3xl opacity-50 animate-pulse" style={{ animationDuration: '4s' }} />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-cyan-600/20 rounded-full blur-3xl opacity-30 animate-pulse" style={{ animationDuration: '7s' }} />
      </div>

      <div className="container relative z-10 px-4 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 mb-8 rounded-full bg-slate-900/50 border border-slate-700/50 backdrop-blur-md animate-fade-in">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="text-sm font-medium text-slate-300">Available for Custom Projects</span>
        </div>

        <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 animate-slide-up bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-200 to-slate-400">
          Beyond Standard<br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-cyan-400">Software Engineering</span>
        </h1>

        <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto mb-10 animate-slide-up" style={{ animationDelay: '0.1s' }}>
          We don't just build apps. We engineer digital ecosystems with military-grade sync, AI-native architecture, and uncompromising performance.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-slide-up" style={{ animationDelay: '0.2s' }}>
          <Link href="/dashboard" className="w-full sm:w-auto px-8 py-4 bg-white text-slate-950 rounded-xl font-bold hover:bg-slate-200 transition-all flex items-center justify-center gap-2 group">
            View Live Demo
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
          <a href="mailto:contact@example.com" className="w-full sm:w-auto px-8 py-4 bg-slate-900 border border-slate-700 text-white rounded-xl font-bold hover:bg-slate-800 transition-all">
            Inquire About Custom Design
          </a>
        </div>
      </div>
    </div>
  );
}

export function Capabilities() {
  const features = [
    {
      icon: <Zap className="w-6 h-6 text-amber-400" />,
      title: "Edge-Native Performance",
      description: "Zero-latency interactions powered by optimized edge functions and local-first state management."
    },
    {
      icon: <Brain className="w-6 h-6 text-violet-400" />,
      title: "AI-Core Architecture",
      description: "Deep integration with RAG & LLMs for semantic search, adaptive interfaces, and predictive analytics."
    },
    {
      icon: <Shield className="w-6 h-6 text-emerald-400" />,
      title: "Sovereign Data Sync",
      description: "Your data, your rules. Universal synchronization to Obsidian/GitHub with full encryption."
    },
    {
      icon: <Sparkles className="w-6 h-6 text-cyan-400" />,
      title: "Fluid Design Systems",
      description: "Bespoke glassmorphism UIs that feel alive, responsive, and indistinguishable from native apps."
    }
  ];

  return (
    <div className="py-24 bg-slate-950 relative overflow-hidden">
      <div className="container px-4 mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Engineering Excellence</h2>
          <p className="text-slate-400">Capabilities available for your next ambition.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((f, i) => (
            <div key={i} className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800/50 hover:bg-slate-900/60 hover:border-slate-700 transition-all group">
              <div className="w-12 h-12 rounded-xl bg-slate-800/50 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                {f.icon}
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">{f.title}</h3>
              <p className="text-slate-400 text-sm leading-relaxed">{f.description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
