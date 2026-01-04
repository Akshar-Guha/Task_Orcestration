'use client';

import { useState } from 'react';
import { revokeAllSessions } from '@/lib/deviceAuth';
import Link from 'next/link';

export default function UmbraPage() {
  const [revoking, setRevoking] = useState(false);
  const [revoked, setRevoked] = useState(false);

  const handleKillSwitch = async () => {
    if (!confirm('⚠️ This will log out ALL devices including this one. Are you sure?')) {
      return;
    }
    
    setRevoking(true);
    const success = await revokeAllSessions();
    
    if (success) {
      setRevoked(true);
      // Reload to show PIN gate
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } else {
      alert('Failed to revoke sessions. Please try again.');
    }
    
    setRevoking(false);
  };

  if (revoked) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="text-center">
          <div className="text-6xl mb-4">🔒</div>
          <h1 className="text-2xl font-bold text-white mb-2">All Sessions Revoked</h1>
          <p className="text-zinc-400">Reloading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link href="/dashboard" className="text-zinc-500 hover:text-white text-sm">
            ← Back to Dashboard
          </Link>
          <h1 className="text-3xl font-bold mt-4 mb-2">🔐 Security Settings</h1>
          <p className="text-zinc-400">
            Manage device authorization and security preferences
          </p>
        </div>

        {/* Quick Links to Settings */}
        <div className="space-y-3 mb-12">
          <Link 
            href="/settings/database" 
            className="block p-4 bg-zinc-900 border border-zinc-800 rounded-xl hover:border-zinc-700 transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">🗄️</span>
              <div>
                <div className="font-semibold">Database Settings</div>
                <div className="text-sm text-zinc-500">Manage Supabase connection</div>
              </div>
            </div>
          </Link>

          <Link 
            href="/settings/notifications" 
            className="block p-4 bg-zinc-900 border border-zinc-800 rounded-xl hover:border-zinc-700 transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">🔔</span>
              <div>
                <div className="font-semibold">Notifications</div>
                <div className="text-sm text-zinc-500">Push notification preferences</div>
              </div>
            </div>
          </Link>

          <Link 
            href="/settings/profile" 
            className="block p-4 bg-zinc-900 border border-zinc-800 rounded-xl hover:border-zinc-700 transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">👤</span>
              <div>
                <div className="font-semibold">Profile</div>
                <div className="text-sm text-zinc-500">Your user profile settings</div>
              </div>
            </div>
          </Link>

          <Link 
            href="/settings/system-status" 
            className="block p-4 bg-zinc-900 border border-zinc-800 rounded-xl hover:border-zinc-700 transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">⚙️</span>
              <div>
                <div className="font-semibold">System Status</div>
                <div className="text-sm text-zinc-500">Check system health</div>
              </div>
            </div>
          </Link>
        </div>

        {/* Kill Switch Section */}
        <div className="border-t border-zinc-800 pt-8">
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6">
            <div className="flex items-start gap-4">
              <div className="text-4xl">☠️</div>
              <div className="flex-1">
                <h2 className="text-xl font-bold text-red-400 mb-2">Kill Switch</h2>
                <p className="text-zinc-400 text-sm mb-4">
                  Immediately revoke access from <strong>ALL devices</strong> including this one.
                  Everyone will need to re-enter the PIN to access the app.
                </p>
                <button
                  onClick={handleKillSwitch}
                  disabled={revoking}
                  className="px-6 py-3 bg-red-600 hover:bg-red-700 disabled:bg-red-900 text-white font-bold rounded-lg transition-colors"
                >
                  {revoking ? '⏳ Revoking...' : '🔐 Revoke All Sessions'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Info */}
        <div className="mt-8 p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl">
          <p className="text-xs text-zinc-500 text-center">
            🔒 This page is only accessible at the secret URL <code className="text-zinc-400">/umbra</code>
          </p>
        </div>
      </div>
    </div>
  );
}
