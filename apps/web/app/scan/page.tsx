'use client';

import React, { useState } from 'react';
import {
  QrCode,
  Search,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  RefreshCw,
  Camera,
  Coins,
  Receipt,
  Gift,
  ShieldCheck,
  Store,
  UserCheck,
  CreditCard,
  Sparkles,
  Smartphone
} from 'lucide-react';
import { Scanner } from '@yudiel/react-qr-scanner';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { apiClient } from '@/lib/api-client';
import { ScanHistoryTable } from '@/components/ScanHistoryTable';

interface PassData {
  memberName: string;
  balance: string;
  tier: string;
  fullPassId: string;
  phone?: string;
  tenantName?: string;
}

interface TransactionResult {
  success: boolean;
  pointsChanged: number;
  newBalance: number;
  discountApplied: number;
  payableAmount: number;
  orderAmount: number;
  orderId: string | null;
  passUpdateStatus: 'pushed_to_wallet' | 'sync_delayed';
  warning?: string;
  tier: string;
  tierChanged: boolean;
  isUpgrade?: boolean;
  transaction: {
    passId: string;
    memberId: string;
    memberName: string;
    action: 'award' | 'redeem';
    source: string;
    timestamp: string;
  };
}

export default function ScanPage() {
  const [passId, setPassId] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [passData, setPassData] = useState<PassData | null>(null);
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');
  const [historyRefresh, setHistoryRefresh] = useState(0);

  const [orderAmount, setOrderAmount] = useState('');
  const [orderId, setOrderId] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [transactionResult, setTransactionResult] = useState<TransactionResult | null>(null);

  const [showScanner, setShowScanner] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');

  const currentPoints = passData
    ? parseInt(passData.balance.replace(/[^0-9]/g, '')) || 0
    : 0;

  const parsedAmount = parseFloat(orderAmount) || 0;
  const awardPreview = Math.floor(parsedAmount * 0.10);
  const maxDeductible = Math.floor(parsedAmount * 0.50);
  const redeemPreview = Math.min(currentPoints, maxDeductible);

  const processPassId = async (scannedId: string) => {
    setPassId(scannedId);
    setIsValidating(true);
    setError('');
    setWarning('');
    setPassData(null);
    setTransactionResult(null);
    setShowScanner(false);

    let finalId = scannedId.trim();
    if (scannedId.includes('/m/')) {
      finalId = scannedId.split('/m/')[1];
    }

    try {
      const data = await apiClient('/passes/validate-pass', {
        method: 'POST',
        body: JSON.stringify({ passId: finalId }),
      });

      if (!data.valid) throw new Error(data.error || 'Pass not found or invalid.');

      setPassData(data);
    } catch (err: any) {
      setError(err.message || 'Pass not found or invalid.');
    } finally {
      setIsValidating(false);
    }
  };

  const handleValidate = (e: React.FormEvent) => {
    e.preventDefault();
    if (passId.trim()) {
      processPassId(passId.trim());
    }
  };

  const handleTransaction = async (action: 'award' | 'redeem') => {
    if (!passData) return;

    setError('');
    setWarning('');

    if (!orderAmount || parsedAmount <= 0) {
      setError('Order amount must be greater than ₹0.');
      return;
    }

    if (action === 'redeem' && currentPoints <= 0) {
      setError('Customer has 0 points available. Point redemption cannot be applied to this order.');
      return;
    }

    setIsProcessing(true);

    try {
      const data: TransactionResult = await apiClient('/passes/process-order', {
        method: 'POST',
        body: JSON.stringify({
          passId: passData.fullPassId,
          amount: parsedAmount,
          action,
          orderId: orderId.trim() || undefined,
        }),
      });

      if (!data.success) {
        throw new Error('Transaction was not successful.');
      }

      setTransactionResult(data);
      setPassData((prev) => (prev ? { ...prev, balance: `${data.newBalance} Pts` } : null));
      setHistoryRefresh((prev) => prev + 1);

      if (data.warning) {
        setWarning(data.warning);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to process transaction.');
    } finally {
      setIsProcessing(false);
    }
  };

  const resetOrderForm = () => {
    setOrderAmount('');
    setOrderId('');
    setTransactionResult(null);
    setError('');
    setWarning('');
  };

  const resetAll = () => {
    resetOrderForm();
    setPassId('');
    setPassData(null);
  };

  return (
    <div className="min-h-screen bg-canvas flex flex-col font-sans">
      {/* Top Header */}
      <header className="border-b border-border-subtle bg-canvas/80 backdrop-blur sticky top-0 z-10 px-4 sm:px-6 py-3.5 flex items-center justify-between shadow-sm">
        <a
          href="/dashboard"
          className="flex items-center gap-2 text-ink-secondary hover:text-brand-blue transition-colors font-medium text-sm flex-1"
        >
          <ArrowLeft className="w-4 h-4" /> Dashboard
        </a>
        <div className="flex items-center gap-2 font-bold text-ink-dark tracking-tight">
          <QrCode className="w-5 h-5 text-brand-blue" />
          <span>Staff Checkout Scanner</span>
        </div>
        <div className="flex-1 text-right">
          {passData && (
            <button
              onClick={resetAll}
              className="text-xs text-ink-secondary hover:text-ink-dark transition-colors px-3 py-1.5 rounded-lg border border-border-subtle bg-surface-card"
            >
              Scan Different Customer
            </button>
          )}
        </div>
      </header>

      {/* Main Content: Responsive Side-by-Side View */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col justify-start">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
          {/* Left Column (5 Cols): Lookup & Scanner */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-surface-card border border-border-subtle p-5 sm:p-6 rounded-2xl shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <h2 className="text-sm font-bold uppercase tracking-wider text-ink-secondary flex items-center gap-2">
                  <Search className="w-4 h-4 text-brand-blue" /> Pass Lookup & Scanner
                </h2>
                <button
                  type="button"
                  onClick={() => setShowScanner(!showScanner)}
                  className={`text-xs px-2.5 py-1 rounded-lg font-medium flex items-center gap-1.5 transition-colors ${
                    showScanner
                      ? 'bg-brand-blue text-white'
                      : 'bg-surface-bone text-ink-secondary hover:text-ink-dark'
                  }`}
                >
                  <Camera className="w-3.5 h-3.5" />
                  {showScanner ? 'Close Camera' : 'Use Camera'}
                </button>
              </div>

              {/* QR Camera Viewport */}
              {showScanner && (
                <div className="rounded-xl overflow-hidden border border-border-subtle aspect-square relative bg-black animate-in fade-in">
                  <Scanner
                    onScan={(result) => {
                      if (result.length > 0) processPassId(result[0].rawValue);
                    }}
                    constraints={{ facingMode }}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'))
                    }
                    className="absolute bottom-3 right-3 bg-surface-bone/90 backdrop-blur text-white px-3 py-1.5 rounded-lg text-xs font-medium z-10 hover:bg-border-strong flex items-center gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Flip Camera
                  </button>
                </div>
              )}

              {/* Lookup Form */}
              <form onSubmit={handleValidate} className="space-y-3">
                <div>
                  <label className="block text-[11px] font-bold text-ink-secondary mb-1.5 uppercase tracking-widest">
                    Customer Phone / Pass ID
                  </label>
                  <div className="flex gap-2">
                    <Input
                      type="text"
                      value={passId}
                      onChange={(e) => setPassId(e.target.value)}
                      placeholder="e.g. 9876543210 or 882190"
                      className="font-mono text-sm"
                      disabled={isValidating}
                    />
                    <Button
                      type="submit"
                      disabled={isValidating || !passId.trim()}
                      className="px-4 shrink-0"
                    >
                      {isValidating ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <Search className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </form>

              <p className="text-xs text-ink-secondary leading-relaxed pt-1">
                Scan customer's Google Wallet pass QR code with the camera, or enter their registered phone number.
              </p>
            </div>

            {/* Active Customer Indicator on Left Column */}
            {passData && (
              <div className="p-4 rounded-xl bg-surface-card border border-brand-blue/30 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-brand-blue/10 flex items-center justify-center text-brand-blue font-bold">
                    <UserCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-ink-dark">{passData.memberName}</p>
                    <p className="text-[11px] text-ink-secondary">Pass loaded & verified</p>
                  </div>
                </div>
                <button
                  onClick={resetAll}
                  className="text-xs text-brand-blue hover:underline font-medium"
                >
                  Clear
                </button>
              </div>
            )}
          </div>

          {/* Right Column (7 Cols): Member Profile, Order Form & Receipt */}
          <div className="lg:col-span-7 space-y-4">
            {/* Error Banner */}
            {error && (
              <div className="p-4 rounded-2xl bg-destructive/10 border border-destructive/30 text-destructive flex items-start gap-3 shadow-sm animate-in slide-in-from-top-2">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h4 className="font-bold text-sm">Action Required</h4>
                  <p className="font-medium text-destructive text-xs mt-0.5 leading-relaxed">{error}</p>
                </div>
                <button
                  onClick={() => setError('')}
                  className="text-xs text-destructive hover:opacity-70 font-bold ml-2"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Warning Banner */}
            {warning && (
              <div className="p-4 rounded-2xl bg-warning-surface border border-warning/30 text-warning flex items-start gap-3 shadow-sm animate-in slide-in-from-top-2">
                <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-warning" />
                <div className="flex-1">
                  <h4 className="font-bold text-sm">Notice</h4>
                  <p className="font-medium text-warning text-xs mt-0.5 leading-relaxed">
                    {warning}. Balance is updated in the store system.
                  </p>
                </div>
              </div>
            )}

            {!passData ? (
              /* Empty State (Waiting for Scan) */
              <div className="bg-surface-card border border-border-subtle p-8 sm:p-12 rounded-2xl shadow-sm text-center flex flex-col items-center justify-center min-h-90">
                <div className="w-14 h-14 rounded-2xl bg-brand-blue/10 border border-brand-blue/20 flex items-center justify-center text-brand-blue mb-4">
                  <CreditCard className="w-7 h-7" />
                </div>
                <h3 className="text-lg font-bold text-ink-dark mb-1.5">Ready to Process Customer</h3>
                <p className="text-xs text-ink-secondary max-w-md mx-auto leading-relaxed mb-6">
                  Scan a customer's pass or lookup their phone number on the left. The customer's loyalty balance and checkout options will appear here.
                </p>
                <div className="grid grid-cols-3 gap-3 w-full max-w-sm text-left">
                  <div className="p-3 bg-canvas rounded-xl border border-border-subtle">
                    <p className="text-[10px] font-bold text-brand-blue uppercase">1. Scan</p>
                    <p className="text-xs text-ink-secondary mt-0.5">Lookup pass</p>
                  </div>
                  <div className="p-3 bg-canvas rounded-xl border border-border-subtle">
                    <p className="text-[10px] font-bold text-emerald-400 uppercase">2. Enter Total</p>
                    <p className="text-xs text-ink-secondary mt-0.5">Type bill amount</p>
                  </div>
                  <div className="p-3 bg-canvas rounded-xl border border-border-subtle">
                    <p className="text-[10px] font-bold text-amber-400 uppercase">3. Settle</p>
                    <p className="text-xs text-ink-secondary mt-0.5">Award or Redeem</p>
                  </div>
                </div>
              </div>
            ) : (
              /* Verified Customer Profile & Order Actions */
              <div className="bg-surface-card border border-border-subtle p-6 rounded-2xl shadow-sm space-y-6 animate-in fade-in">
                {/* Member Header */}
                <div className="flex items-start justify-between border-b border-white/5 pb-4">
                  <div>
                    <h3 className="text-2xl font-bold text-ink-dark">{passData.memberName}</h3>
                    <div className="flex flex-wrap items-center gap-2 mt-1.5">
                      {passData.phone && (
                        <span className="text-xs text-ink-secondary font-mono">{passData.phone}</span>
                      )}
                      {passData.tenantName && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-surface-bone text-ink-secondary border border-border-subtle">
                          <Store className="w-3 h-3 text-brand-blue" />
                          {passData.tenantName}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="inline-flex items-center gap-1 text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full text-xs font-bold border border-emerald-500/20">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Verified Pass
                  </div>
                </div>

                {/* Loyalty Balance Metrics */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-canvas p-3.5 rounded-xl border border-border-subtle">
                    <p className="text-[10px] font-bold text-ink-secondary uppercase tracking-widest mb-1 flex items-center gap-1.5">
                      <Coins className="w-3.5 h-3.5 text-amber-400" /> Available Points
                    </p>
                    <p className="text-2xl font-bold text-ink-dark">{passData.balance}</p>
                  </div>
                  <div className="bg-canvas p-3.5 rounded-xl border border-border-subtle">
                    <p className="text-[10px] font-bold text-ink-secondary uppercase tracking-widest mb-1 flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-brand-blue" /> Membership Tier
                    </p>
                    <p className="text-2xl font-bold text-ink-dark">{passData.tier}</p>
                  </div>
                </div>

                {/* Transaction Result / Customer Receipt State */}
                {transactionResult ? (
                  <div className="p-5 rounded-2xl bg-canvas border border-brand-blue/30 space-y-4 animate-in zoom-in-95">
                    <div className="flex items-center justify-between border-b border-white/5 pb-3">
                      <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                        <span>
                          {transactionResult.transaction.action === 'award'
                            ? 'Points Awarded Successfully'
                            : 'Points Redeemed & Discount Applied'}
                        </span>
                      </div>
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                        <Smartphone className="w-3 h-3" /> Customer Notified
                      </span>
                    </div>

                    {transactionResult.transaction.action === 'redeem' ? (
                      <div className="space-y-3">
                        <div className="p-4 rounded-xl bg-brand-blue/10 border border-brand-blue/30 text-center">
                          <p className="text-[11px] font-bold uppercase tracking-widest text-brand-blue mb-0.5">
                            Collect From Customer
                          </p>
                          <p className="text-3xl font-extrabold text-ink-dark">
                            ₹{transactionResult.payableAmount}
                          </p>
                          <p className="text-xs text-emerald-400 font-medium mt-1">
                            Discount: -₹{transactionResult.discountApplied} ({transactionResult.pointsChanged} pts)
                          </p>
                        </div>

                        <div className="flex justify-between text-xs text-ink-secondary px-1">
                          <span>Original Order: ₹{transactionResult.orderAmount}</span>
                          <span>New Balance: {transactionResult.newBalance} Pts</span>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-center">
                          <p className="text-[11px] font-bold uppercase tracking-widest text-emerald-400 mb-0.5">
                            Points Awarded
                          </p>
                          <p className="text-3xl font-extrabold text-ink-dark">
                            +{transactionResult.pointsChanged} Pts
                          </p>
                          <p className="text-xs text-ink-secondary mt-1">
                            10% loyalty credit on ₹{transactionResult.orderAmount} order
                          </p>
                        </div>

                        <div className="flex justify-between text-xs text-ink-secondary px-1">
                          <span>Order Total: ₹{transactionResult.orderAmount}</span>
                          <span>New Balance: {transactionResult.newBalance} Pts</span>
                        </div>
                      </div>
                    )}

                    {transactionResult?.tierChanged && transactionResult?.isUpgrade && (
                      <div className="mt-3 rounded-md border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-sm text-amber-600">
                        🏆 Customer upgraded to <strong>{transactionResult.tier}</strong> tier!
                      </div>
                    )}

                    <div className="pt-2 flex gap-3">
                      <Button onClick={resetOrderForm} variant="secondary" className="flex-1 text-xs py-2.5">
                        Next Order for This Member
                      </Button>
                      <Button onClick={resetAll} className="flex-1 text-xs py-2.5">
                        Complete & Scan Next
                      </Button>
                    </div>
                  </div>
                ) : (
                  /* Order Form */
                  <div className="space-y-4">
                    <div className="space-y-3">
                      <div>
                        <label className="block text-[11px] font-bold text-ink-secondary mb-1.5 uppercase tracking-widest">
                          Order Amount (₹) *
                        </label>
                        <div className="relative">
                          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-secondary font-bold">
                            ₹
                          </span>
                          <Input
                            type="number"
                            min="1"
                            step="any"
                            value={orderAmount}
                            onChange={(e) => setOrderAmount(e.target.value)}
                            onWheel={(e) => e.currentTarget.blur()}
                            placeholder="e.g. 500"
                            className="pl-8 text-base font-semibold"
                            disabled={isProcessing}
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-ink-secondary mb-1.5 uppercase tracking-widest">
                          Order ID (Optional)
                        </label>
                        <Input
                          type="text"
                          value={orderId}
                          onChange={(e) => setOrderId(e.target.value)}
                          placeholder="e.g. ORD-1024"
                          className="font-mono text-sm"
                          disabled={isProcessing}
                        />
                      </div>
                    </div>

                    {/* Dynamic Savings Previews */}
                    {parsedAmount > 0 && (
                      <div className="p-3 bg-canvas rounded-xl border border-border-subtle text-xs space-y-1.5">
                        <div className="flex justify-between items-center text-ink-secondary">
                          <span>Award 10%:</span>
                          <span className="text-emerald-400 font-bold">+{awardPreview} Pts</span>
                        </div>
                        <div className="flex justify-between items-center text-ink-secondary">
                          <span>Redeem Max 50%:</span>
                          <span className="text-brand-blue font-bold">
                            {currentPoints > 0
                              ? `Save ₹${redeemPreview} (${redeemPreview} pts)`
                              : '0 pts (Insufficient balance)'}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      <Button
                        type="button"
                        onClick={() => handleTransaction('award')}
                        disabled={isProcessing || !orderAmount || parsedAmount <= 0}
                        className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-3 flex items-center justify-center gap-1.5"
                      >
                        {isProcessing ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <Gift className="w-4 h-4" />
                        )}
                        <span>Award Points</span>
                      </Button>

                      <Button
                        type="button"
                        onClick={() => handleTransaction('redeem')}
                        disabled={
                          isProcessing ||
                          !orderAmount ||
                          parsedAmount <= 0 ||
                          currentPoints <= 0
                        }
                        className="w-full bg-brand-blue hover:bg-brand-blue/90 text-white font-semibold py-3 flex items-center justify-center gap-1.5 disabled:opacity-50"
                      >
                        {isProcessing ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <Receipt className="w-4 h-4" />
                        )}
                        <span>
                          {currentPoints <= 0
                            ? 'Redeem (0 Pts)'
                            : 'Redeem Points'}
                        </span>
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Scan & Transaction History */}
        <div className="mt-8">
          <ScanHistoryTable refreshTrigger={historyRefresh} />
        </div>
      </main>
    </div>
  );
}
