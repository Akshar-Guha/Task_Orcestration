
export function Roadmap() {
  const roadmap = [
    { phase: "Now", cap: "Core Features", detail: "Goal hierarchy, AI journaling, sleep tracking, semantic search" },
    { phase: "Live", cap: "Predictive Analytics", detail: "AI predicts: \"You're likely to miss this deadline\"" },
    { phase: "Live", cap: "Smart Recs", detail: "\"Based on your patterns, try this goal structure\"" },
    { phase: "Live", cap: "Voice Interface", detail: "Talk to your second brain hands-free" },
    { phase: "Live", cap: "Multi-device Sync", detail: "Seamless experience across phone/desktop" }
  ];

  return (
    <section className="py-24 bg-slate-950 border-t border-slate-900">
      <div className="container px-4 mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold text-white mb-4">The Mission</h2>
          <p className="text-slate-400">Software that evolves with you.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {roadmap.map((item, i) => (
            <div key={i} className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800 text-center">
              <div className="text-xs font-bold text-violet-400 uppercase tracking-widest mb-2">{item.phase}</div>
              <h3 className="font-bold text-white mb-2">{item.cap}</h3>
              <p className="text-xs text-slate-500">{item.detail}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
