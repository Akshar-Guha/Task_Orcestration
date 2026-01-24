import { Hero } from '@/components/showcase/Hero';
import { ProblemSolution } from '@/components/showcase/ProblemSolution';
import { Personas } from '@/components/showcase/Personas';
import { FeaturesComparison } from '@/components/showcase/FeaturesComparison';
import { Roadmap } from '@/components/showcase/Roadmap';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-950 selection:bg-violet-500/30">
      <Hero />
      <ProblemSolution />
      <Personas />
      <FeaturesComparison />
      <Roadmap />
      
      {/* Footer */}
      <div className="py-24 border-t border-slate-900 bg-slate-950 text-center">
        <h3 className="text-2xl font-bold text-white mb-6">Ready to create your future?</h3>
        <p className="text-slate-500 mb-8">
          The best way to predict your future is to create it. <br />But you can&apos;t see patterns in chaos.
        </p>
        <p className="text-xs text-slate-600 uppercase tracking-widest">© 2026 Personal Life OS</p>
      </div>
    </div>
  );
}
