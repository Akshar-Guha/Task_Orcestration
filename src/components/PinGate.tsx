'use client';

import { useState, useCallback, useEffect } from 'react';

const PAD_KEYS = ['1','2','3','4','5','6','7','8','9','','0','⌫'] as const;

interface PinGateProps {
  onSuccess: () => void;
}

export function PinGate({ onSuccess }: PinGateProps) {
  const [pin, setPin]       = useState('');
  const [isError, setIsError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [shake, setShake]   = useState(false);

  const submitPin = useCallback(async (code: string) => {
    if (loading) return;
    setLoading(true);
    try {
      const res  = await fetch('/api/auth/validate-pin', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ pin: code }),
      });
      const data = await res.json();
      if (data.valid) {
        onSuccess();
      } else {
        setShake(true);
        setIsError(true);
        setPin('');
        setTimeout(() => setShake(false),  520);
        setTimeout(() => setIsError(false), 2200);
      }
    } catch {
      setShake(true);
      setIsError(true);
      setPin('');
      setTimeout(() => setShake(false), 520);
    } finally {
      setLoading(false);
    }
  }, [loading, onSuccess]);

  const pressKey = useCallback((key: string) => {
    if (loading || key === '') return;
    if (key === '⌫') {
      setPin(p => p.slice(0, -1));
      setIsError(false);
      return;
    }
    setIsError(false);
    setPin(prev => {
      const next = (prev + key).slice(0, 6);
      if (next.length === 6) {
        // schedule after paint so the last dot fills before we submit
        requestAnimationFrame(() => submitPin(next));
      }
      return next;
    });
  }, [loading, submitPin]);

  /* physical keyboard support */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key))   pressKey(e.key);
      else if (e.key === 'Backspace') pressKey('⌫');
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [pressKey]);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center select-none"
      style={{
        background: 'var(--bg)',
        backgroundImage:
          'radial-gradient(ellipse 110% 55% at 50% 0%, rgba(91,155,213,0.07) 0%, transparent 70%)',
      }}
    >
      {/* App identity */}
      <div className="mb-12 text-center">
        <p
          className="text-[10px] tracking-[0.35em] uppercase mb-2"
          style={{ color: 'var(--text-3)', fontFamily: 'var(--font-family-body)' }}
        >
          Personal OS
        </p>
        <h1
          className="text-[2rem] font-light tracking-wide"
          style={{
            color:      'var(--text)',
            fontFamily: 'var(--font-family-display)',
            fontStyle:  'italic',
          }}
        >
          GoalTracker
        </h1>
      </div>

      {/* PIN dots */}
      <div className={`flex gap-5 mb-12 ${shake ? 'animate-shake' : ''}`}>
        {Array.from({ length: 6 }).map((_, i) => {
          const filled = i < pin.length;
          return (
            <div
              key={i}
              className="w-3 h-3 rounded-full transition-all duration-150"
              style={{
                background: filled
                  ? isError ? 'var(--coral)' : 'var(--gold)'
                  : 'var(--border)',
                transform:  filled ? 'scale(1.2)'   : 'scale(1)',
                boxShadow:  filled && !isError
                  ? '0 0 12px var(--gold-glow)'
                  : 'none',
              }}
            />
          );
        })}
      </div>

      {/* Numpad */}
      <div className="grid grid-cols-3 gap-3" style={{ width: 288 }}>
        {PAD_KEYS.map((key, i) => {
          if (key === '') return <div key={i} />;
          const isBack = key === '⌫';
          return (
            <button
              key={i}
              onClick={() => pressKey(key)}
              onMouseDown={e => e.preventDefault()}
              disabled={loading || (isBack && pin.length === 0)}
              className="flex items-center justify-center rounded-2xl
                         transition-all duration-100 active:scale-[0.91]
                         disabled:opacity-20"
              style={{
                height:     68,
                fontFamily: isBack ? 'system-ui' : 'var(--font-family-body)',
                fontSize:   isBack ? '1.35rem' : '1.5rem',
                fontWeight: isBack ? 400 : 500,
                color:      isBack ? 'var(--text-2)' : 'var(--text)',
                background: isBack ? 'transparent' : 'var(--surface)',
                border:     isBack ? 'none' : '1px solid var(--border)',
              }}
            >
              {key}
            </button>
          );
        })}
      </div>

      {/* Status row */}
      <div className="flex items-center justify-center mt-8" style={{ height: 36 }}>
        {loading && (
          <div
            className="w-5 h-5 rounded-full border-2 animate-spin"
            style={{
              borderColor:    'var(--border)',
              borderTopColor: 'var(--gold)',
            }}
          />
        )}
        {isError && !loading && (
          <p
            className="text-sm animate-fade-in"
            style={{ color: 'var(--coral)', fontFamily: 'var(--font-family-body)' }}
          >
            Incorrect PIN — try again
          </p>
        )}
      </div>

      <p
        className="absolute bottom-8 text-[11px] tracking-wide text-center px-6"
        style={{ color: 'var(--text-3)', fontFamily: 'var(--font-family-body)' }}
      >
        Device stays authorized until kill switch
      </p>
    </div>
  );
}
