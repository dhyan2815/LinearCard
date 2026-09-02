import React from 'react';
import { CreditCard } from 'lucide-react';
import Link from 'next/link';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-canvas text-ink-dark font-sans relative overflow-hidden">
      {/* Subtle Grain / Glow background overlay */}
      <div className="fixed inset-0 z-0 pointer-events-none opacity-20 bg-[radial-gradient(ellipse_at_top,var(--tw-gradient-stops))] from-border-strong via-canvas to-canvas" />

      <header className="border-b border-border-subtle bg-canvas/80 backdrop-blur-xl sticky top-0 z-40">
        <div className="w-full px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-brand-blue flex items-center justify-center shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]">
                <CreditCard className="w-4 h-4 text-white" />
              </div>
              <span className="font-semibold text-base text-ink-dark tracking-tight">LinearCard Admin</span>
            </Link>
          </div>
          <div className="flex items-center gap-4">
             <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              API Connected
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
