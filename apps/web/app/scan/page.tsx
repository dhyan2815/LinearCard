'use client';

import React, { useState } from 'react';
import { QrCode, Search, CheckCircle2, AlertCircle, ArrowLeft, RefreshCw, Camera } from 'lucide-react';
import { Scanner } from '@yudiel/react-qr-scanner';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';

export default function ScanPage() {
  const [passId, setPassId] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [passData, setPassData] = useState<{ memberName: string; balance: string; tier: string; fullPassId: string; phone?: string } | null>(null);
  const [error, setError] = useState('');
  
  const [redemptionAmount, setRedemptionAmount] = useState('');
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [showScanner, setShowScanner] = useState(false);

  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');

  const processPassId = async (scannedId: string) => {
    setPassId(scannedId);
    setIsValidating(true);
    setError('');
    setPassData(null);
    setSuccessMsg('');
    setShowScanner(false);
    
    // Attempt to extract the passId if it's a URL (e.g. from the barcode generated in enroll)
    // The consumer's scanner might read the full intent URI
    let finalId = scannedId;
    if (scannedId.includes('/m/')) {
       finalId = scannedId.split('/m/')[1];
    }
    
    try {
      const res = await fetch('/api/validate-pass', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passId: finalId })
      });
      
      const data = await res.json();
      if (!res.ok || !data.valid) throw new Error(data.error || 'Invalid Pass');
      
      setPassData(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsValidating(false);
    }
  };

  const handleValidate = (e: React.FormEvent) => {
    e.preventDefault();
    if (passId) {
      processPassId(passId);
    }
  };

  const handleRedeem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passData || !redemptionAmount) return;
    
    setIsRedeeming(true);
    setError('');
    
    try {
      const currentPts = parseInt(passData.balance.replace(/[^0-9]/g, '')) || 0;
      const redeemPts = parseInt(redemptionAmount) || 0;
      
      // Prevent redeeming if the pass is already empty
      if (currentPts === 0) {
        throw new Error('Pass has already been fully redeemed.');
      }
      
      // Prevent redeeming more points than the user has available
      if (redeemPts > currentPts) {
        throw new Error('Insufficient points balance.');
      }
      
      const newBalance = `${currentPts - redeemPts}`;
      
      const demoPhone = passData.phone || '';
      
      const res = await fetch('/api/update-pass', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          passId: passData.fullPassId, 
          balance: newBalance,
          tier: passData.tier,
          pushNotification: `You redeemed ${redeemPts} points. New balance: ${newBalance}.`,
          phone: demoPhone,
          brandName: 'LinearCard'
        })
      });
      
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to process redemption');
      
      setSuccessMsg(`Successfully redeemed ${redeemPts} points. New balance is ${newBalance}.`);
      setPassData(prev => prev ? { ...prev, balance: newBalance } : null);
      setRedemptionAmount('');
      
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsRedeeming(false);
    }
  };

  return (
    <div className="min-h-screen bg-canvas flex flex-col font-sans">
      <header className="border-b border-white/5 bg-canvas/80 backdrop-blur sticky top-0 z-10 px-4 py-3 flex items-center justify-between shadow-sm">
        <a href="/dashboard" className="flex items-center gap-2 text-ink-secondary hover:text-brand-blue transition-colors font-medium text-sm flex-1">
          <ArrowLeft className="w-4 h-4" /> Dashboard
        </a>
        <div className="flex items-center gap-2 font-bold text-ink-dark tracking-tight">
          <QrCode className="w-5 h-5 text-brand-blue" />
          <span>Staff Scanner</span>
        </div>
        <div className="flex-1"></div> {/* Spacer for centering */}
      </header>
      
      <main className="flex-1 max-w-md w-full mx-auto p-4 flex flex-col gap-6 pt-8 pb-12 animate-in fade-in duration-300">
        
        <div className="bg-surface-card border border-border-subtle p-6 rounded-2xl shadow-sm">
          <h2 className="text-lg font-bold text-ink-dark mb-4 flex items-center gap-2">
            <Search className="w-5 h-5 text-ink-secondary" /> Lookup Pass
          </h2>
          
          <form onSubmit={handleValidate} className="space-y-4">
            <div>
              <label className="block text-[11px] font-bold text-ink-secondary mb-2 uppercase tracking-widest">Barcode Alt Text / Pass ID</label>
              <div className="flex gap-2">
                <Input 
                  type="text" 
                  value={passId}
                  onChange={(e) => setPassId(e.target.value)}
                  placeholder="e.g. 882190" 
                  className="font-mono"
                />
                <button type="button" onClick={() => setShowScanner(!showScanner)} className="bg-surface-bone text-ink-dark rounded-xl px-4 flex items-center justify-center hover:bg-border-strong transition-colors">
                  <Camera className="w-5 h-5" />
                </button>
              </div>
            </div>
            {showScanner && (
              <div className="rounded-xl overflow-hidden border border-border-subtle aspect-square relative bg-black">
                <Scanner onScan={(result) => { if(result.length > 0) processPassId(result[0].rawValue); }} constraints={{ facingMode }} />
                <button 
                  type="button" 
                  onClick={() => setFacingMode(prev => prev === 'environment' ? 'user' : 'environment')} 
                  className="absolute bottom-4 right-4 bg-surface-bone/80 backdrop-blur text-white px-3 py-1.5 rounded-lg text-xs font-medium z-10 hover:bg-border-strong/80 flex items-center gap-2"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Flip Camera
                </button>
              </div>
            )}
            <Button type="submit" disabled={isValidating || !passId} className="w-full">
              {isValidating ? <RefreshCw className="w-5 h-5 animate-spin" /> : 'Validate Pass'}
            </Button>
          </form>
        </div>

        {error && (
          <div className="p-6 rounded-2xl bg-rose-500/10 border-2 border-rose-500/30 text-rose-500 flex flex-col items-center justify-center text-center shadow-lg shadow-rose-500/10 animate-in slide-in-from-bottom-4">
            <div className="w-12 h-12 rounded-full bg-rose-500/20 flex items-center justify-center mb-3">
              <AlertCircle className="w-7 h-7 text-rose-500" />
            </div>
            <h3 className="text-xl font-bold uppercase tracking-widest mb-1">
              {error.toLowerCase().includes('redeemed') ? 'Already Redeemed' : 'Invalid Pass'}
            </h3>
            <p className="font-medium text-rose-400 text-sm">{error}</p>
          </div>
        )}
        
        {successMsg && (
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" /> 
            <p className="font-medium">{successMsg}</p>
          </div>
        )}

        {passData && (
          <div className="bg-surface-card border-2 border-brand-blue/30 p-6 rounded-2xl shadow-lg shadow-brand-blue/10 animate-in slide-in-from-bottom-4">
            <div className="flex items-start justify-between border-b border-white/5 pb-4 mb-4">
              <div>
                <p className="text-[10px] font-bold text-ink-secondary uppercase tracking-widest mb-1">Member Name</p>
                <h3 className="text-xl font-bold text-ink-dark">{passData.memberName}</h3>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold text-ink-secondary uppercase tracking-widest mb-1">Status</p>
                <div className="inline-flex items-center gap-1 text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded text-xs font-bold border border-emerald-500/20">
                  <CheckCircle2 className="w-3 h-3" /> Valid
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <div className="bg-canvas p-3 rounded-xl border border-border-subtle">
                <p className="text-[10px] font-bold text-ink-secondary uppercase tracking-widest mb-1">Current Balance</p>
                <p className="text-lg font-bold text-ink-dark">{passData.balance}</p>
              </div>
              <div className="bg-canvas p-3 rounded-xl border border-border-subtle">
                <p className="text-[10px] font-bold text-ink-secondary uppercase tracking-widest mb-1">Tier</p>
                <p className="text-lg font-bold text-ink-dark">{passData.tier}</p>
              </div>
            </div>
            
            <form onSubmit={handleRedeem} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-ink-secondary mb-2 uppercase tracking-widest">Redeem Points</label>
                <div className="flex gap-2">
                  <Input 
                    type="number" 
                    min="1"
                    value={redemptionAmount}
                    onChange={(e) => setRedemptionAmount(e.target.value)}
                    placeholder="Amount to deduct" 
                    className="flex-1"
                    required
                  />
                  <Button type="submit" disabled={isRedeeming || !redemptionAmount} className="px-4 py-2">
                    {isRedeeming ? <RefreshCw className="w-5 h-5 animate-spin" /> : 'Redeem'}
                  </Button>
                </div>
              </div>
            </form>
          </div>
        )}
        
      </main>
    </div>
  );
}
