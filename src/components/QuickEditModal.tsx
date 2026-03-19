'use client';

import { useState } from 'react';
import type { Goal } from '@/lib/types';
import { useUpdateGoal } from '@/lib/hooks/useSupabase';

interface QuickEditModalProps {
  goal: Goal;
  onClose: () => void;
}

export function QuickEditModal({ goal, onClose }: QuickEditModalProps) {
  const updateGoalMutation = useUpdateGoal();
  const [title, setTitle] = useState(goal.title);
  const [description, setDescription] = useState(goal.description || '');
  const [status, setStatus] = useState(goal.status);
  const [deadline, setDeadline] = useState(goal.deadline ? goal.deadline.split('T')[0] : '');
  const [priority, setPriority] = useState<1 | 2 | 3>(goal.priority || 2);

  const handleSave = async () => {
    updateGoalMutation.mutate({
      id: goal.id,
      updates: {
        title,
        description,
        status,
        priority,
        deadline: deadline ? new Date(deadline).toISOString() : undefined,
      }
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md max-h-[80vh] overflow-y-auto">
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white">Quick Edit</h2>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white text-2xl"
            >
              ×
            </button>
          </div>

          {/* Title */}
          <div>
            <label className="text-sm text-slate-400 block mb-2">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-violet-500"
              style={{ fontSize: '16px' }}
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-sm text-slate-400 block mb-2">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-violet-500 resize-none"
              rows={3}
              style={{ fontSize: '16px' }}
            />
          </div>

          {/* Deadline */}
          <div>
            <label className="text-sm text-slate-400 block mb-2">Target Deadline</label>
            <input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-violet-500 [color-scheme:dark]"
            />
          </div>

          {/* Status */}
          <div>
            <label className="text-sm text-slate-400 block mb-2">Status</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: 'not_started' as const, label: 'Not Started', color: 'bg-amber-500' },
                { value: 'in_progress' as const, label: 'In Progress', color: 'bg-blue-500' },
                { value: 'completed' as const, label: 'Completed', color: 'bg-emerald-500' },
              ].map((s) => (
                <button
                  key={s.value}
                  onClick={() => setStatus(s.value)}
                  className={`py-3 rounded-lg text-sm font-medium transition-all ${
                    status === s.value
                      ? `${s.color} text-white`
                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Priority */}
          <div>
            <label className="text-sm text-slate-400 block mb-2">Priority</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: 1, label: 'Critical', color: 'bg-red-500' },
                { value: 2, label: 'Important', color: 'bg-yellow-500' },
                { value: 3, label: 'Nice-to-have', color: 'bg-green-500' },
              ].map((p) => (
                <button
                  key={p.value}
                  onClick={() => setPriority(p.value as 1 | 2 | 3)}
                  className={`py-3 rounded-lg text-sm font-medium transition-all ${
                    priority === p.value
                      ? `${p.color} text-white`
                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              onClick={onClose}
              className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-medium transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="flex-1 py-3 bg-violet-600 hover:bg-violet-700 text-white rounded-lg font-medium transition-all"
            >
              Save
            </button>
          </div>

          {/* Link to full edit page */}
          <div className="text-center pt-2">
            <a
              href="/edit"
              className="text-sm text-violet-400 hover:text-violet-300 underline"
            >
              Need more options? Go to full Edit page →
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
