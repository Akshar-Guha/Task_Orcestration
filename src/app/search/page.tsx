import { SemanticSearch } from '@/khoj';

export const metadata = {
  title: 'Search - MTO Second Brain',
  description: 'Search across all your goals, tasks, and memories',
};

export default function SearchPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white">
      <div className="max-w-4xl mx-auto px-4 py-12">
        <header className="mb-12 text-center">
          <h1 className="text-4xl font-bold mb-4">
            🧠 Search Your Second Brain
          </h1>
          <p className="text-gray-400 text-lg">
            Semantic search across goals, tasks, memories, and notes
          </p>
        </header>

        <SemanticSearch />

        <footer className="mt-16 text-center text-sm text-gray-600">
          <p>Powered by Khoj AI • Self-hosted on Oracle Cloud</p>
        </footer>
      </div>
    </div>
  );
}
