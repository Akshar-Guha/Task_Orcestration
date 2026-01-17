'use client';

import { useState, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import type { ProductivityData } from '@/lib/diary-types';

interface ExtractionResult {
  mood?: number;
  energyLevel?: number;
  wins?: string[];
  challenges?: string[];
  productivityData?: ProductivityData;
  summary?: string;
  suggestedGoals?: string[];
  suggestedTasks?: string[];
}

type Step = 'capture' | 'review' | 'questions' | 'confirm';

export default function NewDiaryEntryPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const dateParam = searchParams.get('date') || new Date().toISOString().split('T')[0];
  
  const [step, setStep] = useState<Step>('capture');
  const [freeformText, setFreeformText] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionError, setExtractionError] = useState<string | null>(null);
  const [extraction, setExtraction] = useState<ExtractionResult | null>(null);
  
  // Editable extracted data
  const [mood, setMood] = useState<number>(3);
  const [energy, setEnergy] = useState<number>(5);
  const [wins, setWins] = useState<string[]>([]);
  const [challenges, setChallenges] = useState<string[]>([]);
  const [productivityData, setProductivityData] = useState<ProductivityData>({});
  const [summary, setSummary] = useState('');
  
  const [isSaving, setIsSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const formattedDate = new Date(dateParam + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  // Extract structured data from free-form text
  async function handleExtract() {
    if (!freeformText.trim()) return;
    
    setIsExtracting(true);
    setExtractionError(null);
    
    try {
      const res = await fetch('/api/diary/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: freeformText }),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Extraction failed');
      }
      
      const ext = data.extraction as ExtractionResult;
      setExtraction(ext);
      
      // Pre-fill editable fields
      if (ext.mood) setMood(ext.mood);
      if (ext.energyLevel) setEnergy(ext.energyLevel);
      if (ext.wins) setWins(ext.wins);
      if (ext.challenges) setChallenges(ext.challenges);
      if (ext.productivityData) setProductivityData(ext.productivityData);
      if (ext.summary) setSummary(ext.summary);
      
      setStep('review');
    } catch (err) {
      setExtractionError(err instanceof Error ? err.message : 'Failed to extract data');
    } finally {
      setIsExtracting(false);
    }
  }

  // Skip extraction and go directly to manual entry
  function handleSkipExtraction() {
    setStep('review');
  }

  // Save the entry
  async function handleSave() {
    setIsSaving(true);
    
    try {
      const res = await fetch('/api/diary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: dateParam,
          mood,
          energyLevel: energy,
          summary: summary || undefined,
          wins: wins.length > 0 ? wins : undefined,
          challenges: challenges.length > 0 ? challenges : undefined,
          productivityData: Object.keys(productivityData).length > 0 ? productivityData : undefined,
        }),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save entry');
      }
      
      router.push('/diary');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  }

  // Add/remove wins
  function addWin() {
    setWins([...wins, '']);
  }
  function updateWin(index: number, value: string) {
    const newWins = [...wins];
    newWins[index] = value;
    setWins(newWins);
  }
  function removeWin(index: number) {
    setWins(wins.filter((_, i) => i !== index));
  }

  // Add/remove challenges
  function addChallenge() {
    setChallenges([...challenges, '']);
  }
  function updateChallenge(index: number, value: string) {
    const newChallenges = [...challenges];
    newChallenges[index] = value;
    setChallenges(newChallenges);
  }
  function removeChallenge(index: number) {
    setChallenges(challenges.filter((_, i) => i !== index));
  }

  // Productivity category helpers
  const productivityCategories = [
    { key: 'deep_work', label: 'Deep Work', icon: '💻', color: '#22c55e' },
    { key: 'shallow_work', label: 'Shallow Work', icon: '📧', color: '#eab308' },
    { key: 'meetings', label: 'Meetings', icon: '👥', color: '#3b82f6' },
    { key: 'exercise', label: 'Exercise', icon: '🏃', color: '#ef4444' },
    { key: 'leisure', label: 'Leisure', icon: '🎮', color: '#a855f7' },
    { key: 'waste', label: 'Waste', icon: '📱', color: '#6b7280' },
  ];

  function updateProductivity(key: string, minutes: number) {
    setProductivityData(prev => ({
      ...prev,
      [key]: minutes > 0 ? minutes : undefined,
    }));
  }

  // Mood emoji
  const moodEmojis = ['😢', '😕', '😐', '🙂', '😊'];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-10 backdrop-blur-xl bg-black/20 border-b border-white/10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/diary" className="text-white/60 hover:text-white transition">
              ← Back
            </Link>
            <h1 className="text-xl font-bold text-white">New Entry</h1>
          </div>
          <div className="text-white/60 text-sm">{formattedDate}</div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        {/* Step 1: Free-form Capture */}
        {step === 'capture' && (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <div className="text-4xl mb-3">✨</div>
              <h2 className="text-2xl font-bold text-white mb-2">How was your day?</h2>
              <p className="text-white/60">Tell me about your day freely. I&apos;ll help extract the key details.</p>
            </div>

            <textarea
              ref={textareaRef}
              value={freeformText}
              onChange={(e) => setFreeformText(e.target.value)}
              placeholder="Today I worked on the Khoj integration... deployed to VPS... had some DNS issues but figured it out... exercised for 30 minutes..."
              className="w-full h-64 p-4 bg-white/5 border border-white/20 rounded-xl text-white placeholder-white/40 resize-none focus:outline-none focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20"
            />

            {extractionError && (
              <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 text-red-200">
                {extractionError}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={handleExtract}
                disabled={isExtracting || !freeformText.trim()}
                className="flex-1 py-3 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-xl font-medium hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isExtracting ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
                    Analyzing...
                  </span>
                ) : (
                  '🪄 Extract Details'
                )}
              </button>
              <button
                onClick={handleSkipExtraction}
                className="px-6 py-3 bg-white/10 text-white/80 rounded-xl font-medium hover:bg-white/20 transition"
              >
                Skip
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Review & Edit */}
        {step === 'review' && (
          <div className="space-y-8">
            {extraction && (
              <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 text-green-200 text-sm">
                ✅ Extracted data from your entry. Review and edit below.
              </div>
            )}

            {/* Mood & Energy */}
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-white/80 text-sm font-medium mb-3">Mood</label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((m) => (
                    <button
                      key={m}
                      onClick={() => setMood(m)}
                      className={`flex-1 py-3 text-2xl rounded-lg transition ${
                        mood === m
                          ? 'bg-purple-500/30 border-2 border-purple-500'
                          : 'bg-white/5 border border-white/10 hover:bg-white/10'
                      }`}
                    >
                      {moodEmojis[m - 1]}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-white/80 text-sm font-medium mb-3">Energy ({energy}/10)</label>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={energy}
                  onChange={(e) => setEnergy(parseInt(e.target.value))}
                  className="w-full h-3 bg-white/10 rounded-lg appearance-none cursor-pointer accent-purple-500"
                />
                <div className="flex justify-between text-xs text-white/40 mt-1">
                  <span>Exhausted</span>
                  <span>Energized</span>
                </div>
              </div>
            </div>

            {/* Summary */}
            <div>
              <label className="block text-white/80 text-sm font-medium mb-2">Summary</label>
              <textarea
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="A brief summary of your day..."
                className="w-full h-24 p-3 bg-white/5 border border-white/20 rounded-xl text-white placeholder-white/40 resize-none focus:outline-none focus:border-purple-500/50"
              />
            </div>

            {/* Wins */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-white/80 text-sm font-medium">🏆 Wins</label>
                <button onClick={addWin} className="text-purple-400 text-sm hover:text-purple-300">+ Add</button>
              </div>
              <div className="space-y-2">
                {wins.map((win, i) => (
                  <div key={i} className="flex gap-2">
                    <input
                      value={win}
                      onChange={(e) => updateWin(i, e.target.value)}
                      placeholder="Something you accomplished..."
                      className="flex-1 p-3 bg-white/5 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-green-500/50"
                    />
                    <button onClick={() => removeWin(i)} className="text-red-400 hover:text-red-300 px-2">×</button>
                  </div>
                ))}
                {wins.length === 0 && (
                  <div className="text-white/40 text-sm italic">No wins added yet</div>
                )}
              </div>
            </div>

            {/* Challenges */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-white/80 text-sm font-medium">⚠️ Challenges</label>
                <button onClick={addChallenge} className="text-purple-400 text-sm hover:text-purple-300">+ Add</button>
              </div>
              <div className="space-y-2">
                {challenges.map((challenge, i) => (
                  <div key={i} className="flex gap-2">
                    <input
                      value={challenge}
                      onChange={(e) => updateChallenge(i, e.target.value)}
                      placeholder="Something that blocked you..."
                      className="flex-1 p-3 bg-white/5 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-amber-500/50"
                    />
                    <button onClick={() => removeChallenge(i)} className="text-red-400 hover:text-red-300 px-2">×</button>
                  </div>
                ))}
                {challenges.length === 0 && (
                  <div className="text-white/40 text-sm italic">No challenges added yet</div>
                )}
              </div>
            </div>

            {/* Productivity Time */}
            <div>
              <label className="block text-white/80 text-sm font-medium mb-3">⏱️ Time Breakdown (minutes)</label>
              <div className="grid grid-cols-2 gap-3">
                {productivityCategories.map((cat) => (
                  <div key={cat.key} className="flex items-center gap-3 p-3 bg-white/5 rounded-lg border border-white/10">
                    <span className="text-xl">{cat.icon}</span>
                    <span className="flex-1 text-white/80 text-sm">{cat.label}</span>
                    <input
                      type="number"
                      min="0"
                      step="15"
                      value={productivityData[cat.key] || ''}
                      onChange={(e) => updateProductivity(cat.key, parseInt(e.target.value) || 0)}
                      placeholder="0"
                      className="w-16 p-2 bg-white/10 border border-white/20 rounded text-white text-center text-sm focus:outline-none focus:border-purple-500/50"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <button
                onClick={() => setStep('capture')}
                className="px-6 py-3 bg-white/10 text-white/80 rounded-xl font-medium hover:bg-white/20 transition"
              >
                ← Back
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex-1 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl font-medium hover:opacity-90 transition disabled:opacity-50"
              >
                {isSaving ? 'Saving...' : '✓ Save Entry'}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
