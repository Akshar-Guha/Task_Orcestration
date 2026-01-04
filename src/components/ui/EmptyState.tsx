'use client';

interface EmptyStateProps {
  title?: string;
  description?: string;
  icon?: 'goals' | 'search' | 'error';
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({ 
  title = "No goals for today",
  description = "Start by creating your first goal to track your progress",
  icon = 'goals',
  action
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6 animate-fade-in">
      <div className="text-violet-400 opacity-80 mb-6">
        {icon === 'goals' && (
          <svg width="64" height="64" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="32" cy="32" r="28" strokeDasharray="4 4" opacity="0.3" />
            <circle cx="32" cy="32" r="20" opacity="0.5" />
            <circle cx="32" cy="32" r="12" />
            <circle cx="32" cy="32" r="4" fill="currentColor" />
          </svg>
        )}
      </div>
      
      <h3 className="text-xl font-semibold text-slate-100 mb-2">{title}</h3>
      <p className="text-sm text-slate-400 max-w-[280px] mb-6">{description}</p>
      
      {action && (
        <button 
          className="px-5 py-2.5 bg-violet-500 hover:bg-violet-400 text-white text-sm font-medium rounded-lg transition-all shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40"
          onClick={action.onClick}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
