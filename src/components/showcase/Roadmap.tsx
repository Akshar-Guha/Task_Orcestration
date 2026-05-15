
export function Roadmap() {
  const roadmap = [
    { phase: "Live", cap: "Behavioral Data System", detail: "Goal dependency DAG, time-slot scheduling, sleep-productivity correlation, adaptive diary engine, behavioral event log" },
    { phase: "Live", cap: "Android + NudgeEngine", detail: "Kotlin/Compose native app, WorkManager NudgeEngine with 6 contextual triggers, step sensor, Supabase realtime sync" },
    { phase: "Live", cap: "Semantic Memory", detail: "384-dim embeddings, pgvector semantic search, in-context retrieval across all behavioral data" },
    { phase: "Live", cap: "ML Dataset Export", detail: "Structured behavioral data export endpoint — personal training corpus designed for productivity model fine-tuning" },
    { phase: "Next", cap: "Production RAG Eval", detail: "RAGAS-based retrieval quality, hybrid BM25 + semantic search, cross-encoder reranking, embedding version management" },
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
