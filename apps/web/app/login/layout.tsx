import React from 'react';
import { CreditCard, ChevronLeft } from 'lucide-react';
import Link from 'next/link';

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-canvas text-ink-dark font-sans relative overflow-hidden">
      <div className="fixed inset-0 z-0 pointer-events-none opacity-20 bg-[radial-gradient(ellipse_at_top,var(--tw-gradient-stops))] from-border-strong via-canvas to-canvas" />

      <header className="border-b border-white/5 bg-canvas/80 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-ink-dark transition-colors">
              <ChevronLeft className="w-4 h-4" /> Back
            </Link>
            <div className="w-px h-4 bg-white/10 hidden sm:block"></div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-brand-blue flex items-center justify-center shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]">
                <CreditCard className="w-4 h-4 text-white" />
              </div>
              <span className="font-semibold text-base text-ink-dark tracking-tight">LinearCard Admin</span>
            </div>
          </div>
        </div>
      </header>

      <div className="relative z-10 flex-1 flex flex-col">
        {children}
      </div>
    </div>
  );
}
