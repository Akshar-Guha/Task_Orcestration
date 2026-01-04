'use client';

import { useAppStore } from '@/lib/store';

export default function ProfileSettingsPage() {
  const { userSettings, updateSettings } = useAppStore();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
        <h2 className="text-xl font-bold text-white mb-2">Profile Settings</h2>
        <p className="text-sm text-slate-500">
          User preferences and personalization
        </p>
      </div>

      {/* Preferences */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Preferences</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-2">
              Daily Summary Time
            </label>
            <input
              type="time"
              value={userSettings.dailySummaryTime}
              onChange={(e) => updateSettings({ dailySummaryTime: e.target.value })}
              className="w-full p-3 bg-slate-800/50 rounded-lg border border-slate-700 text-white focus:outline-none focus:border-violet-500"
            />
          </div>

          <div className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg">
            <div>
              <div className="text-sm font-medium text-white">Daily Summary Reminder</div>
              <div className="text-xs text-slate-500 mt-1">
                Get notified to complete your daily summary
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={userSettings.enableDailySummaryReminder}
                onChange={(e) => updateSettings({ enableDailySummaryReminder: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-violet-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-violet-600"></div>
            </label>
          </div>
        </div>
      </div>

      {/* Account Info */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Account Information</h3>
        <div className="text-center py-8 text-slate-600">
          <div className="text-4xl mb-3">👤</div>
          <p>User authentication coming soon</p>
          <p className="text-sm mt-2">Supabase Auth integration in progress</p>
        </div>
      </div>
    </div>
  );
}
