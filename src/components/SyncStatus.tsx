'use client';

/**
 * Sync Status Component
 * 
 * Visual indicator showing Obsidian sync status.
 * Displays pending syncs, last sync time, and errors.
 */

import { useState, useEffect } from 'react';
import { getSyncStatus, updateLocalSyncStatus } from '@/lib/obsidian-sync';

// ... (inside component)

              if (data.success) {
                setStatus('success');
                setMessage(`Synced Daily Warehouse: ${data.results?.history?.synced || 0} daily entries updated!`);
                updateLocalSyncStatus({ 
                    lastSync: new Date().toISOString(),
                    error: null
                });
              } else {

interface SyncStatusState {
  lastSync: string | null;
  pending: number;
  syncing: boolean;
  error: string | null;
}

export function SyncStatus() {
  const [status, setStatus] = useState<SyncStatusState>({
    lastSync: null,
    pending: 0,
    syncing: false,
    error: null,
  });
  const [isConfigured, setIsConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    // Check if GitHub is configured
    const checkConfig = async () => {
      try {
        const response = await fetch('/api/obsidian/status');
        if (response.ok) {
          const data = await response.json();
          setIsConfigured(data.configured);
        }
      } catch {
        setIsConfigured(false);
      }
    };

    checkConfig();

    // Poll sync status every 2 seconds
    const interval = setInterval(() => {
      const currentStatus = getSyncStatus();
      setStatus(currentStatus);
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  // Don't show if not configured
  if (isConfigured === false) {
    return null;
  }

  // Waiting for config check
  if (isConfigured === null) {
    return null;
  }

  const formatLastSync = (dateStr: string | null) => {
    if (!dateStr) return 'Never';
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="sync-status">
      <div className="sync-status-indicator">
        {status.syncing ? (
          <span className="sync-icon syncing">
            <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
          </span>
        ) : status.error ? (
          <span className="sync-icon error" title={status.error}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </span>
        ) : status.pending > 0 ? (
          <span className="sync-icon pending">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </span>
        ) : (
          <span className="sync-icon synced">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </span>
        )}
      </div>

      <div className="sync-status-text">
        {status.syncing ? (
          <span>Syncing to Obsidian...</span>
        ) : status.pending > 0 ? (
          <span>{status.pending} pending</span>
        ) : (
          <span>Last sync: {formatLastSync(status.lastSync)}</span>
        )}
      </div>

      <style jsx>{`
        .sync-status {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 12px;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 20px;
          font-size: 12px;
          color: #888;
        }
        
        .sync-status-indicator {
          display: flex;
          align-items: center;
        }
        
        .sync-icon {
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .sync-icon.syncing {
          color: #60a5fa;
        }
        
        .sync-icon.error {
          color: #ef4444;
        }
        
        .sync-icon.pending {
          color: #f59e0b;
        }
        
        .sync-icon.synced {
          color: #22c55e;
        }
        
        .sync-status-text {
          white-space: nowrap;
        }
        
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        
        .animate-spin {
          animation: spin 1s linear infinite;
        }
      `}</style>
    </div>
  );
}

/**
 * Compact sync indicator for headers/navbars
 */
export function SyncIndicator() {
  const [status, setStatus] = useState<SyncStatusState>({
    lastSync: null,
    pending: 0,
    syncing: false,
    error: null,
  });

  useEffect(() => {
    const interval = setInterval(() => {
      const currentStatus = getSyncStatus();
      setStatus(currentStatus);
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  if (!status.syncing && status.pending === 0 && !status.error) {
    return null; // Hide when everything is synced
  }

  return (
    <div 
      className={`sync-indicator ${status.syncing ? 'syncing' : status.error ? 'error' : 'pending'}`}
      title={status.error || (status.pending > 0 ? `${status.pending} pending syncs` : 'Syncing...')}
    >
      <style jsx>{`
        .sync-indicator {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          animation: pulse 1.5s ease-in-out infinite;
        }
        
        .sync-indicator.syncing {
          background: #60a5fa;
        }
        
        .sync-indicator.error {
          background: #ef4444;
        }
        
        .sync-indicator.pending {
          background: #f59e0b;
        }
        
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}
