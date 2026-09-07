'use client';

import React, { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import confetti from 'canvas-confetti';
import { Check, ExternalLink, X, Smartphone, ShieldCheck, Sparkles } from 'lucide-react';
export interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  passResult: any; // Type as any for now or specific structure
}

export default function WalletModal({ isOpen, onClose, passResult }: WalletModalProps): React.JSX.Element | null {
  const [copied, setCopied] = useState(false);

  useEffect(function initializeConfetti() {
    // Fire confetti only when the modal is opened
    if (isOpen) {
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 }
        });
      } catch (e) {
        // Fallback gracefully if confetti fails to load or execute
        console.error('Confetti error:', e);
      }
    }
  }, [isOpen]);

  // Prevent rendering if modal is closed or pass data is missing
  if (!isOpen || !passResult) return null;

  const { googleWalletUrl, passId, passData } = passResult;

  async function handleCopy() {
    // Ensure there is a URL to copy
    if (!googleWalletUrl) return;
    try {
      await navigator.clipboard.writeText(googleWalletUrl);
      setCopied(true);
      // Reset copied state after 2.5 seconds
      setTimeout(function resetCopyState() { setCopied(false); }, 2500);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-md max-h-[95vh] overflow-y-auto bg-[#11131a] border border-white/10 rounded-3xl p-5 sm:p-6 shadow-2xl scrollbar-hide"
        style={{
          boxShadow: '0 25px 60px -15px rgba(99, 102, 241, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.1)'
        }}
      >
        <div className="absolute -top-24 -right-24 w-60 h-60 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-60 h-60 bg-pink-500/15 rounded-full blur-3xl pointer-events-none" />

        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors z-10"
          aria-label="Close modal"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center space-y-1.5 mb-4 mt-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" /> Pass Ready for Google Wallet
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">
            Your Pass is Live!
          </h2>
          <p className="text-xs text-slate-400 max-w-xs mx-auto leading-relaxed">
            Scan the QR code with your phone camera or click the button below to add it directly to Google Wallet.
          </p>
        </div>

        <div className="flex flex-col items-center justify-center p-4 bg-white rounded-2xl shadow-inner my-4 max-w-60 mx-auto border border-slate-200">
          <div className="p-1 bg-white rounded-xl">
            <QRCodeSVG
              value={googleWalletUrl}
              size={150}
              level="L"
              includeMargin={true}
            />
          </div>
          <div className="flex items-center gap-1.5 mt-2 text-slate-600 text-[11px] font-medium">
            <Smartphone className="w-3.5 h-3.5 text-indigo-600" />
            <span>Point your phone camera to scan</span>
          </div>
        </div>

        <div className="space-y-2.5 mt-4">
          <a
            href={googleWalletUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full wallet-btn-link text-center justify-center py-2.5"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
            </svg>
            <span className="text-sm">Add to Google Wallet</span>
            <ExternalLink className="w-3.5 h-3.5 ml-1 opacity-70" />
          </a>

          <div className="flex gap-2">
            <button
              onClick={handleCopy}
              className="flex-1 btn-secondary text-[13px] py-2"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span className="text-emerald-400 font-semibold">Link Copied!</span>
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-slate-400">
                    <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
                    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
                  </svg>
                  <span>Copy Pass Link</span>
                </>
              )}
            </button>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-[10px] text-slate-500 font-mono">
          <span>ID: {passId ? passId.slice(0, 16) + '...' : 'Generated'}</span>
          <span className="flex items-center gap-1 text-slate-400">
            <ShieldCheck className="w-3 h-3 text-indigo-400" /> Signed RS256 JWT
          </span>
        </div>
      </div>
    </div>
  );
}
