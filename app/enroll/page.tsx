'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function EnrollFallbackPage() {
  const router = useRouter();

  useEffect(() => {
    // Auto-redirect to the internal demo slug for backwards compatibility or fallback testing
    router.push('/enroll/linearcard_demo');
  }, [router]);

  return (
    <main className="min-h-screen bg-canvas text-ink-dark flex flex-col w-full mx-auto px-4 py-20 items-center justify-center text-center">
       <h2 className="text-xl font-medium text-ink-dark mb-2">LinearCard Internal Demo</h2>
       <p className="text-sm text-ink-secondary mb-4">
         This is an internal LinearCard test enrollment. Redirecting to demo pass...
       </p>
       <div className="w-6 h-6 border-2 border-brand-orange/30 border-t-brand-orange rounded-full animate-spin mx-auto"/>
    </main>
  );
}
