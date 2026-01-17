'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function EditPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to dashboard - all editing is now inline!
    router.push('/dashboard');
  }, [router]);

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="text-center">
        <div className="text-6xl mb-4 animate-pulse">✨</div>
        <p className="text-white text-lg">Redirecting to dashboard...</p>
        <p className="text-slate-500 text-sm mt-2">All editing is now inline!</p>
      </div>
    </div>
  );
}
