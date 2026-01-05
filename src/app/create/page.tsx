'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import type { GoalLevel, CreateGoalInput, CreateTaskInput, GoalMetadata } from '@/lib/types';



export default function CreatePage() {

  const router = useRouter();
  const { addGoal, addTask, goals } = useAppStore();
  
  const [tab, setTab] = useState<'goal' | 'task'>('task');
  
  // Goal form
  const [goalLevel] = useState<GoalLevel>('uncategorized');
  const [goalTitle, setGoalTitle] = useState('');
  const [goalDescription, setGoalDescription] = useState('');
  
  // Task form
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [isRepeating, setIsRepeating] = useState(false);
  const [requiredCount, setRequiredCount] = useState(10);
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
  
  const getGoalMetadata = (): GoalMetadata => {
    return { type: 'uncategorized' };
  };
  
  const handleCreateGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!goalTitle.trim()) return;
    
    const input: CreateGoalInput = {
      title: goalTitle.trim(),
      description: goalDescription.trim(),
      level: goalLevel,
      metadata: getGoalMetadata(),
    };
    
    addGoal(input);
    router.push('/goals');
  };
  
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim()) return;
    
    const input: CreateTaskInput = {
      title: taskTitle.trim(),
      description: taskDescription.trim(),
      isRepeating,
      requiredCount: isRepeating ? requiredCount : undefined,
      goalId: selectedGoalId || undefined, // Single parent goal
    };
    
    addTask(input);
    router.push('/planner');
  };
  
  // Handle Obsidian launch
  const handleOpenObsidian = () => {
    // Open Obsidian with a new note in the specified vault
    const obsidianUrl = `obsidian://new?vault=My%20Repo&name=Untitled`;
    window.location.href = obsidianUrl;
  };

  return (
    <div className="min-h-screen bg-slate-950 pb-24">
      <div className="max-w-md mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold text-white mb-6">Create New</h1>
        
        {/* Obsidian Launcher */}
        <button
          onClick={handleOpenObsidian}
          className="w-full mb-6 p-4 bg-purple-900/30 border-2 border-purple-500/50 hover:border-purple-500 rounded-xl flex items-center justify-between group transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center text-2xl">
              📝
            </div>
            <div className="text-left">
              <div className="text-white font-semibold">Open in Obsidian</div>
              <div className="text-xs text-purple-300">Create note in canvas</div>
            </div>
          </div>
          <div className="text-purple-400 group-hover:text-purple-300 transition-colors">
            →
          </div>
        </button>
        
        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setTab('task')}
            className={`flex-1 py-3 rounded-xl font-medium transition-all ${
              tab === 'task'
                ? 'bg-violet-500 text-white'
                : 'bg-slate-900 text-slate-500 border border-slate-800'
            }`}
          >
            ✅ Task
          </button>
          <button
            onClick={() => setTab('goal')}
            className={`flex-1 py-3 rounded-xl font-medium transition-all ${
              tab === 'goal'
                ? 'bg-violet-500 text-white'
                : 'bg-slate-900 text-slate-500 border border-slate-800'
            }`}
          >
            🎯 Goal
          </button>
        </div>
        
        {/* Task Form */}
        {tab === 'task' && (
          <form onSubmit={handleCreateTask} className="space-y-5">
            <div>
              <label className="block text-xs text-slate-500 uppercase tracking-wider mb-2">Task Name</label>
              <input
                type="text"
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                placeholder="e.g., Watch React tutorial"
                className="w-full px-4 py-3 bg-slate-900 border border-slate-800 rounded-xl text-white placeholder:text-slate-600 focus:outline-none focus:border-violet-500"
                autoFocus
                required
              />
            </div>
            
            <div>
              <label className="block text-xs text-slate-500 uppercase tracking-wider mb-2">
                Description <span className="text-slate-700">(optional)</span>
              </label>
              <textarea
                value={taskDescription}
                onChange={(e) => setTaskDescription(e.target.value)}
                placeholder="Add more details..."
                rows={2}
                className="w-full px-4 py-3 bg-slate-900 border border-slate-800 rounded-xl text-white placeholder:text-slate-600 focus:outline-none focus:border-violet-500 resize-none"
              />
            </div>
            
            {/* Repetition Toggle */}
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <div className="text-white font-medium">Repeating Task</div>
                  <div className="text-xs text-slate-500">Track multiple completions (e.g., 30 times)</div>
                </div>
                <input
                  type="checkbox"
                  checked={isRepeating}
                  onChange={(e) => setIsRepeating(e.target.checked)}
                  className="w-12 h-6 bg-slate-800 rounded-full appearance-none cursor-pointer transition-all relative
                    checked:bg-violet-500
                    after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:w-5 after:h-5 after:bg-white after:rounded-full after:transition-all
                    checked:after:left-[26px]"
                />
              </label>
              
              {isRepeating && (
                <div className="mt-4">
                  <label className="block text-xs text-slate-500 mb-2">How many times?</label>
                  <input
                    type="number"
                    min={1}
                    max={1000}
                    value={requiredCount}
                    onChange={(e) => setRequiredCount(parseInt(e.target.value) || 1)}
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                  />
                </div>
              )}
            </div>
            
            {/* Link to Goal (Single) */}
            <div>
              <label className="block text-xs text-slate-500 uppercase tracking-wider mb-2">Link to Goal (Single Parent)</label>
              <div className="bg-slate-900 border border-slate-800 rounded-xl max-h-48 overflow-y-auto p-2 space-y-1">
                {goals.filter(g => !g.isArchived).length === 0 ? (
                  <div className="text-slate-500 text-sm p-2 text-center">No goals created yet.</div>
                ) : (
                  <>
                    {/* No Goal Option */}
                    <button
                      type="button"
                      onClick={() => setSelectedGoalId(null)}
                      className={`w-full flex items-center gap-3 p-2 rounded-lg text-left transition-colors ${
                        selectedGoalId === null ? 'bg-slate-700/50 border border-slate-600' : 'hover:bg-slate-800 border border-transparent'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                        selectedGoalId === null ? 'bg-slate-500 border-slate-500' : 'border-slate-600'
                      }`}>
                        {selectedGoalId === null && <span className="w-2 h-2 bg-white rounded-full"></span>}
                      </div>
                      <span className="text-sm text-slate-400">No linked goal (standalone task)</span>
                    </button>
                    
                    {/* Goals */}
                    {goals.filter(g => !g.isArchived).map(goal => {
                      const isSelected = selectedGoalId === goal.id;
                      const statusIcon = goal.status === 'completed' ? '🟢' : goal.status === 'in_progress' ? '🔵' : '🟡';
                      return (
                        <button
                          key={goal.id}
                          type="button"
                          onClick={() => setSelectedGoalId(goal.id)}
                          className={`w-full flex items-center gap-3 p-2 rounded-lg text-left transition-colors ${
                            isSelected ? 'bg-violet-500/20 border border-violet-500/50' : 'hover:bg-slate-800 border border-transparent'
                          }`}
                        >
                          <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                            isSelected ? 'bg-violet-500 border-violet-500' : 'border-slate-600'
                          }`}>
                            {isSelected && <span className="w-2 h-2 bg-white rounded-full"></span>}
                          </div>
                          <span className="text-lg">{statusIcon}</span>
                          <div className="flex-1 min-w-0">
                            <div className={`text-sm font-medium truncate ${isSelected ? 'text-violet-200' : 'text-slate-300'}`}>
                              {goal.title}
                            </div>
                            <div className="text-[10px] text-slate-500 uppercase">{goal.level}</div>
                          </div>
                        </button>
                      );
                    })}
                  </>
                )}
              </div>
            </div>

            <button
              type="submit"
              disabled={!taskTitle.trim()}
              className="w-full py-4 bg-gradient-to-r from-violet-500 to-cyan-500 text-white font-bold rounded-xl disabled:opacity-40"
            >
              ✅ Create Task
            </button>
            
          </form>
        )}
        
        {/* Goal Form */}
        {tab === 'goal' && (
          <form onSubmit={handleCreateGoal} className="space-y-5">
            {/* Removed Goal Level Selector */}
            
            <div>
              <label className="block text-xs text-slate-500 uppercase tracking-wider mb-2">Goal Title</label>
              <input
                type="text"
                value={goalTitle}
                onChange={(e) => setGoalTitle(e.target.value)}
                placeholder="What do you want to achieve?"
                className="w-full px-4 py-3 bg-slate-900 border border-slate-800 rounded-xl text-white placeholder:text-slate-600 focus:outline-none focus:border-violet-500"
                required
              />
            </div>
            
            <div>
              <label className="block text-xs text-slate-500 uppercase tracking-wider mb-2">
                Description <span className="text-slate-700">(optional)</span>
              </label>
              <textarea
                value={goalDescription}
                onChange={(e) => setGoalDescription(e.target.value)}
                placeholder="Add more details..."
                rows={3}
                className="w-full px-4 py-3 bg-slate-900 border border-slate-800 rounded-xl text-white placeholder:text-slate-600 focus:outline-none focus:border-violet-500 resize-none"
              />
            </div>
            
            <button
              type="submit"
              disabled={!goalTitle.trim()}
              className="w-full py-4 bg-gradient-to-r from-violet-500 to-cyan-500 text-white font-bold rounded-xl disabled:opacity-40"
            >
              🎯 Create Goal
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
