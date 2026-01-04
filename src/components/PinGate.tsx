'use client';

import { useState, useCallback } from 'react';

interface PinGateProps {
  onSuccess: () => void;
}

export function PinGate({ onSuccess }: PinGateProps) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (pin.length !== 6) {
      setError('PIN must be 6 digits');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      const response = await fetch('/api/auth/validate-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      });
      
      const data = await response.json();
      
      if (data.valid) {
        onSuccess();
      } else {
        setError('Invalid PIN');
        setPin('');
      }
    } catch {
      setError('Verification failed');
    } finally {
      setLoading(false);
    }
  }, [pin, onSuccess]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
    setPin(value);
    setError('');
  };

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-xl z-50 flex items-center justify-center p-4">
      <div className="bg-zinc-900/80 border border-zinc-700 rounded-2xl p-8 max-w-sm w-full shadow-2xl">
        <div className="text-center mb-8">
          <div className="text-5xl mb-4">🔐</div>
          <h1 className="text-2xl font-bold text-white mb-2">Device Authorization</h1>
          <p className="text-zinc-400 text-sm">
            Enter your 6-digit PIN to authorize this device
          </p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={pin}
              onChange={handleChange}
              placeholder="• • • • • •"
              className="w-full text-center text-3xl tracking-[0.5em] py-4 px-6 bg-zinc-800 border border-zinc-600 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              autoFocus
              disabled={loading}
            />
          </div>
          
          {error && (
            <div className="text-red-400 text-sm text-center bg-red-500/10 py-2 rounded-lg">
              {error}
            </div>
          )}
          
          <button
            type="submit"
            disabled={pin.length !== 6 || loading}
            className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-700 disabled:text-zinc-500 text-white font-semibold rounded-xl transition-colors"
          >
            {loading ? 'Verifying...' : 'Authorize Device'}
          </button>
        </form>
        
        <p className="text-zinc-500 text-xs text-center mt-6">
          This device will stay authorized until you use the kill switch
        </p>
      </div>
    </div>
  );
}
