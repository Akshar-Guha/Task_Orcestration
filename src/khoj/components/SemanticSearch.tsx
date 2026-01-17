'use client';

import { useState, useCallback } from 'react';

interface SearchResult {
  title?: string;
  content: string;
  score: number;
  source?: string;
}

export default function SemanticSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSearch = useCallback(async () => {
    if (!query.trim() || query.length < 2) {
      setError('Query must be at least 2 characters');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/khoj/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, limit: 10 }),
      });

      if (!response.ok) {
        throw new Error('Search failed');
      }

      const data = await response.json();
      setResults(data.results || []);
    } catch (err) {
      console.error('Search error:', err);
      setError('Search failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !loading) {
      handleSearch();
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-4">
      {/* Search Input */}
      <div className="flex gap-3 mb-6">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search your second brain..."
          className="flex-1 px-4 py-3 rounded-xl bg-gray-800/50 border border-gray-700 
                     focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 
                     transition-all outline-none"
          disabled={loading}
        />
        <button
          onClick={handleSearch}
          disabled={loading || !query.trim()}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 
                     rounded-xl font-medium transition-colors"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <span className="animate-spin">⏳</span>
              Searching...
            </span>
          ) : (
            '🔍 Search'
          )}
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400">
          {error}
        </div>
      )}

      {/* Results */}
      <div className="space-y-4">
        {results.length === 0 && !loading && query && (
          <div className="text-center text-gray-500 py-8">
            No results found for "{query}"
          </div>
        )}

        {results.map((result, index) => (
          <div
            key={index}
            className="p-4 bg-gray-800/50 border border-gray-700 rounded-xl 
                       hover:border-gray-600 transition-colors"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <h3 className="font-semibold text-lg">
                  {result.title || 'Untitled'}
                </h3>
                <p className="text-gray-400 mt-2 line-clamp-3">
                  {result.content}
                </p>
              </div>
              {result.source && (
                <span className="text-xs px-2 py-1 bg-gray-700 rounded-full text-gray-400">
                  {result.source}
                </span>
              )}
            </div>
            <div className="mt-3 flex items-center gap-4 text-sm text-gray-500">
              <span>Score: {(result.score * 100).toFixed(1)}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
