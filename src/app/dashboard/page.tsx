'use client';


import { useAppStore } from '@/lib/store';

import { SleepButton } from '@/components/sleep/SleepButton';

export default function DashboardPage() {
  const {
    lifeRoutines,
    getLifeRoutineProgress,
    initializeLifeRoutines,
  } = useAppStore();



  // Initialize if empty
  if (lifeRoutines.length === 0) {
    return (
      <div className="min-h-screen bg-slate-950 pb-24">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🎯</div>
            <h2 className="text-2xl font-bold text-white mb-3">Welcome to Life Routines!</h2>
            <p className="text-slate-400 mb-6">Let&apos;s set up your Health and Money foundations</p>
            <button
              onClick={initializeLifeRoutines}
              className="px-6 py-3 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-medium transition-all"
            >
              Initialize Life Routines
            </button>
          </div>
        </div>
      </div>
    );
  }



  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white mb-1">Today&apos;s Life Routines</h1>
        <p className="text-sm text-slate-500">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Sleep/Wake Buttons - Only one shows based on time */}
      <SleepButton />

      {/* Life Routine Cards */}
      <div className="space-y-4">
        {lifeRoutines
          .filter((lr) => lr.isActive)
          .sort((a, b) => a.priority - b.priority)
          .map((lifeRoutine) => {
            const progress = getLifeRoutineProgress(lifeRoutine.type);


            return (
              <div
                key={lifeRoutine.id}
                className="p-6 bg-slate-900/50 border border-slate-800 rounded-xl"
                style={{ borderLeftWidth: '4px', borderLeftColor: lifeRoutine.color }}
              >
                {/* Life Routine Header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{lifeRoutine.icon}</span>
                    <div>
                      <h2 className="text-xl font-bold text-white">{lifeRoutine.name}</h2>
                      <p className="text-sm text-slate-500">
                        {progress.completed}/{progress.total} tasks
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-2xl font-bold" style={{ color: lifeRoutine.color }}>
                        {progress.percentage}%
                      </div>
                      <div className="text-xs text-slate-600">Complete</div>
                    </div>
                    <div className="w-24 h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full transition-all duration-500"
                        style={{
                          width: `${progress.percentage}%`,
                          backgroundColor: lifeRoutine.color,
                        }}
                      />
                    </div>
                  </div>
                </div>


              </div>
            );
          })}
      </div>
    </div>
  );
}
