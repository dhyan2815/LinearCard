'use client';

import React from 'react';
import { Sparkles, CreditCard, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Link from 'next/link';

export default function Home() {

  const btnPrimaryClass = "bg-brand-blue text-white font-medium border border-white/10 rounded-xl px-5 py-3 cursor-pointer inline-flex items-center justify-center gap-2 text-sm transition-all hover:bg-brand-blue-hover active:scale-[0.98] shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]";

  const fadeUp = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, type: 'spring' as const, bounce: 0, damping: 20 } }
  };

  return (
    <div className="min-h-screen flex flex-col bg-canvas text-ink-dark font-sans relative overflow-hidden">
      {/* Subtle Grain / Glow background overlay */}
      <div className="fixed inset-0 z-0 pointer-events-none opacity-20 bg-[radial-gradient(ellipse_at_top,var(--tw-gradient-stops))] from-border-strong via-canvas to-canvas" />

      <header className="border-b border-white/5 bg-canvas/80 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-brand-blue flex items-center justify-center shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]">
              <CreditCard className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold text-base text-ink-dark tracking-tight">LinearCard</span>
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
        <AnimatePresence mode="wait">
          <motion.main key="landing" initial="hidden" animate="visible" exit="hidden" variants={fadeUp} className="flex-1 max-w-5xl w-full mx-auto px-6 py-20 flex flex-col justify-center min-h-[80vh]">
             <div className="max-w-3xl space-y-8">
               <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-brand-blue/10 text-brand-blue text-xs font-medium border border-brand-blue/20">
                 <Sparkles className="w-3.5 h-3.5" /> Next-generation digital identity
               </div>
               <h1 className="text-5xl sm:text-7xl font-semibold text-ink-dark tracking-tight leading-tight">
                 Your wallet.<br/>
                 <span className="text-brand-blue">No apps required.</span>
               </h1>
               <p className="text-lg text-ink-secondary max-w-xl leading-relaxed">
                 LinearCard is a wallet-native loyalty and digital-identity platform for brands in India. Issue real passes to Apple, Google, and Samsung Wallets without developer accounts, and engage members directly via WhatsApp.
               </p>
               <div className="pt-4 flex flex-col sm:flex-row items-center gap-4">
                 <Link href="/enroll" className={`${btnPrimaryClass} px-8 py-3.5 text-base`}>
                   Enroll Now <ArrowRight className="w-4 h-4"/>
                 </Link>
               </div>
               <div className="pt-16 flex items-center gap-6">
                 <Link href="/login" className="text-sm font-medium text-ink-muted hover:text-ink-dark transition-colors">
                   Developer Login &rarr;
                 </Link>
                 <a href="/scan" className="text-sm font-medium text-ink-muted hover:text-ink-dark transition-colors">
                   Staff Scanner &rarr;
                 </a>
               </div>
             </div>
          </motion.main>
        </AnimatePresence>
      </div>
    </div>
  );
}
