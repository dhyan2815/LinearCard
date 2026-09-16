'use client';

import React, { useState, useEffect } from 'react';
import {
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Gift,
  Receipt,
  User,
  Zap,
  ShoppingBag,
  Coins,
  ShieldCheck,
  Smartphone,
  Store,
  ArrowRight,
  Sparkles,
  CreditCard,
  ChevronDown,
  Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { apiClient } from '@/lib/api-client';

interface MemberOption {
  id: string;
  name: string;
  phone?: string;
  passId?: string;
  fullPassId?: string;
  balance?: number;
  tenantName?: string;
}

export default function PosSimulatorPage() {
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [selectedPassId, setSelectedPassId] = useState('');
  const [customPassId, setCustomPassId] = useState('');
  const [orderAmount, setOrderAmount] = useState('500');
  const [orderId, setOrderId] = useState('');
  const [action, setAction] = useState<'award' | 'redeem'>('award');

  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');
  const [receiptData, setReceiptData] = useState<any>(null);
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);

  const generateOrderId = () => {
    return `ORD-${Math.floor(1000 + Math.random() * 9000)}`;
  };

  useEffect(() => {
    setOrderId(generateOrderId());
    setIsLoadingMembers(true);
    apiClient('/members')
      .then((data) => {
        if (data.success && data.members) {
          const list: MemberOption[] = [];
          data.members.forEach((m: any) => {
            const resolvedTenantName =
              (Array.isArray(m.Tenant) ? m.Tenant[0]?.name : m.Tenant?.name) ||
              '';
            if (m.passes && m.passes.length > 0) {
              m.passes.forEach((p: any) => {
                list.push({
                  id: m.id,
                  name: m.name || 'Member',
                  phone: m.phone,
                  passId: p.id,
                  fullPassId: p.fullPassId,
                  balance: p.balance,
                  tenantName: resolvedTenantName || 'LinearCard',
                });
              });
            }
          });
          setMembers(list);
          if (list.length > 0 && !selectedPassId) {
            setSelectedPassId(list[0].passId || list[0].fullPassId || '');
          }
        }
      })
      .catch((err) => {
        console.error('Failed to load members for simulator:', err);
      })
      .finally(() => {
        setIsLoadingMembers(false);
      });
  }, []);

  const activePassId = customPassId.trim() || selectedPassId;
  const parsedAmount = parseFloat(orderAmount) || 0;
  const currentMember = members.find(
    (m) => m.passId === selectedPassId || m.fullPassId === selectedPassId
  );
  const memberBalance = currentMember?.balance || 0;

  const awardPreview = Math.floor(parsedAmount * 0.10);
  const maxDeductible = Math.floor(parsedAmount * 0.50);
  const redeemPreview = Math.min(memberBalance, maxDeductible);

  const handleSendWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setWarning('');
    setReceiptData(null);

    if (!activePassId) {
      setError('Please select or specify a customer pass.');
      return;
    }

    if (parsedAmount <= 0) {
      setError('Order amount must be greater than ₹0.');
      return;
    }

    if (action === 'redeem' && memberBalance <= 0) {
      setError('Customer has 0 points available. Point redemption cannot be applied.');
      return;
    }

    setIsSending(true);

    const payload = {
      pass_id: activePassId,
      amount: parsedAmount,
      action,
      order_id: orderId.trim() || undefined,
    };

    try {
      const data = await apiClient('/passes/webhooks/mock', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (!data.success) {
        throw new Error(data.error || 'Transaction was not successful.');
      }

      setReceiptData({
        ...data,
        customerName: currentMember?.name || data.transaction?.memberName || 'Customer',
        customerPhone: currentMember?.phone || '',
        storeName: currentMember?.tenantName || 'Store Checkout',
        previousBalance: memberBalance,
      });

      if (data.warning) {
        setWarning(data.warning);
      }

      // Update local member balance preview
      if (data.newBalance !== undefined) {
        setMembers((prev) =>
          prev.map((m) =>
            m.passId === activePassId || m.fullPassId === activePassId
              ? { ...m, balance: data.newBalance }
              : m
          )
        );
      }
    } catch (err: any) {
      setError(err.message || 'Failed to process register transaction.');
    } finally {
      setIsSending(false);
    }
  };

  const startNextSale = () => {
    setReceiptData(null);
    setOrderId(generateOrderId());
    setError('');
    setWarning('');
  };

  return (
    <div className="min-h-full pb-12">
      <div className="max-w-[1600px] mx-auto space-y-6">
        {/* Page Header */}
        <div className="border-b border-border-subtle pb-4 mb-6">
          <h2 className="text-xl font-medium text-ink-dark tracking-tight">POS Simulator</h2>
          <p className="text-sm text-ink-secondary mt-1">
            Simulate point-of-sale register checkouts, automated loyalty calculations, and real-time customer mobile receipts.
          </p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 lg:gap-12 items-start">
          {/* Left Column (5 Cols): Register Checkout Input */}
          <div className="xl:col-span-5 lg:col-span-5 space-y-6">
          <div className="bg-surface-card border border-border-subtle p-6 rounded-2xl shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <h2 className="text-sm font-bold uppercase tracking-wider text-ink-secondary flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-brand-blue" /> Register Checkout
              </h2>
              <span className="text-xs text-ink-secondary">Simulated POS Terminal</span>
            </div>

            <form onSubmit={handleSendWebhook} className="space-y-4">
              {/* Customer Selector */}
              <div>
                <label className="block text-[11px] font-bold text-ink-secondary mb-1.5 uppercase tracking-widest">
                  Customer
                </label>
                {members.length > 0 && (
                  <div className="relative mb-2">
                    <button
                      type="button"
                      onClick={() => setIsCustomerDropdownOpen(!isCustomerDropdownOpen)}
                      className="hover:bg-surface-hover bg-canvas border border-border-subtle rounded-md text-[13px] font-semibold text-ink-dark px-3 py-2 w-full flex items-center justify-between focus:outline-none transition-colors"
                    >
                      <span className="truncate pr-2 text-left">
                        {customPassId.trim()
                          ? `Custom: ${customPassId}`
                          : currentMember
                          ? `${currentMember.name} (${currentMember.phone || 'No phone'}) • ${currentMember.tenantName || 'Store'} • ${currentMember.balance ?? 0} Pts`
                          : 'Select Member'}
                      </span>
                      <ChevronDown
                        className={`w-3.5 h-3.5 text-ink-muted shrink-0 transition-transform ${
                          isCustomerDropdownOpen ? 'rotate-180' : ''
                        }`}
                      />
                    </button>

                    <AnimatePresence>
                      {isCustomerDropdownOpen && (
                        <>
                          <div
                            className="fixed inset-0 z-40"
                            onClick={() => setIsCustomerDropdownOpen(false)}
                          />
                          <motion.div
                            initial={{ opacity: 0, y: -5 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -5 }}
                            transition={{ duration: 0.15 }}
                            className="absolute top-full left-0 w-full mt-1 bg-surface-card border border-border-subtle rounded-md shadow-lg z-50 overflow-hidden py-1 flex flex-col max-h-60 overflow-y-auto"
                          >
                            <span className="text-[10px] uppercase font-semibold text-ink-muted px-3 py-1.5 tracking-wider">
                              Select Member
                            </span>
                            {members.map((m, idx) => {
                              const isSelected =
                                !customPassId.trim() &&
                                ((m.passId && m.passId === selectedPassId) ||
                                  (m.fullPassId && m.fullPassId === selectedPassId));
                              return (
                                <button
                                  key={idx}
                                  type="button"
                                  onClick={() => {
                                    setSelectedPassId(m.passId || m.fullPassId || '');
                                    setCustomPassId('');
                                    setIsCustomerDropdownOpen(false);
                                  }}
                                  className="w-full text-left px-3 py-2 text-xs text-ink-dark hover:bg-canvas/80 flex items-center justify-between transition-colors outline-none focus:bg-canvas/80"
                                >
                                  <span className="truncate">
                                    {m.name} ({m.phone || 'No phone'}) • {m.tenantName || 'Store'} • {m.balance ?? 0} Pts
                                  </span>
                                  {isSelected && (
                                    <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0 ml-2" />
                                  )}
                                </button>
                              );
                            })}
                          </motion.div>
                        </>
                      )}
                    </AnimatePresence>
                  </div>
                )}

                <Input
                  type="text"
                  value={customPassId}
                  onChange={(e) => setCustomPassId(e.target.value)}
                  placeholder="Or enter custom Pass ID / Phone number"
                  className="font-mono text-xs"
                />
              </div>

              {/* Order Reference & Regenerate */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-bold text-ink-secondary uppercase tracking-widest">
                    Order Reference
                  </label>
                  <button
                    type="button"
                    onClick={() => setOrderId(generateOrderId())}
                    className="text-[11px] text-brand-blue hover:underline flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" /> New Order ID
                  </button>
                </div>
                <Input
                  type="text"
                  value={orderId}
                  onChange={(e) => setOrderId(e.target.value)}
                  className="font-mono text-sm"
                  required
                />
              </div>

              {/* Order Amount */}
              <div>
                <label className="block text-[11px] font-bold text-ink-secondary mb-1.5 uppercase tracking-widest">
                  Order Bill Total (₹)
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
                    placeholder="500"
                    className="pl-8 text-base font-semibold"
                    required
                  />
                </div>
              </div>

              {/* Loyalty Action Selector */}
              <div>
                <label className="block text-[11px] font-bold text-ink-secondary mb-1.5 uppercase tracking-widest">
                  Loyalty Action
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setAction('award')}
                    className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all ${
                      action === 'award'
                        ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400 ring-1 ring-emerald-500/40'
                        : 'bg-canvas border-border-subtle text-ink-secondary hover:border-ink-secondary/30'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-sm">
                      <Gift className="w-4 h-4 text-emerald-400" /> Award Points
                    </div>
                    <span className="text-[11px] mt-1 opacity-80">
                      Add +{awardPreview} pts (10%)
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAction('redeem')}
                    className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all ${
                      action === 'redeem'
                        ? 'bg-brand-blue/10 border-brand-blue/40 text-brand-blue ring-1 ring-brand-blue/40'
                        : 'bg-canvas border-border-subtle text-ink-secondary hover:border-ink-secondary/30'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-sm">
                      <Receipt className="w-4 h-4 text-brand-blue" /> Redeem Points
                    </div>
                    <span className="text-[11px] mt-1 opacity-80">
                      Save ₹{redeemPreview} (Max 50%)
                    </span>
                  </button>
                </div>
              </div>

              {/* Error Alert */}
              {error && (
                <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-500 flex items-start gap-2.5 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div className="flex-1 font-medium">{error}</div>
                </div>
              )}

              {/* Warning Alert */}
              {warning && (
                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-start gap-2.5 text-xs">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div className="flex-1 font-medium">{warning}</div>
                </div>
              )}

              {/* Checkout Submit Button */}
              <Button
                type="submit"
                disabled={isSending || !activePassId || parsedAmount <= 0}
                className="w-full bg-brand-blue hover:bg-brand-blue/90 text-white font-semibold py-3 flex items-center justify-center gap-2 text-sm"
              >
                {isSending ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <ShoppingBag className="w-4 h-4" />
                )}
                <span>{isSending ? 'Processing Checkout...' : 'Process Register Checkout'}</span>
              </Button>
            </form>
          </div>
        </div>

        {/* Right Column (7 Cols): Digital Store Receipt & Customer Summary */}
        <div className="xl:col-span-7 lg:col-span-7 space-y-6">
          {receiptData ? (
            /* Itemized Digital Store Receipt */
            <div className="bg-surface-card border border-border-subtle rounded-2xl shadow-sm overflow-hidden animate-in fade-in">
              {/* Receipt Header Banner */}
              <div className="p-6 bg-canvas border-b border-border-subtle flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Store className="w-4 h-4 text-brand-blue" />
                    <h3 className="text-base font-bold text-ink-dark">{receiptData.storeName}</h3>
                  </div>
                  <p className="text-xs text-ink-secondary">
                    Receipt #{receiptData.orderId || 'TXN-001'} • {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>

              {/* Customer Info */}
              <div className="px-6 py-4 border-b border-white/5 bg-surface-card flex items-center justify-between text-sm">
                <div>
                  <span className="text-ink-secondary">Customer: </span>
                  <span className="font-bold text-ink-dark">{receiptData.customerName}</span>
                  {receiptData.customerPhone && (
                    <span className="text-ink-secondary font-mono ml-2">({receiptData.customerPhone})</span>
                  )}
                </div>
              </div>

              {/* Itemized Calculation */}
              <div className="p-6 space-y-4">
                <div className="space-y-2.5 text-sm">
                  <div className="flex justify-between text-ink-secondary">
                    <span>Order Bill Subtotal:</span>
                    <span className="font-medium text-ink-dark">₹{receiptData.orderAmount}</span>
                  </div>

                  {receiptData.discountApplied > 0 && (
                    <div className="flex justify-between text-emerald-400 font-semibold">
                      <span>Loyalty Discount ({receiptData.pointsChanged} pts):</span>
                      <span>-₹{receiptData.discountApplied}</span>
                    </div>
                  )}

                  {receiptData.transaction?.action === 'award' && (
                    <div className="flex justify-between text-emerald-400 font-semibold">
                      <span>Points Earned (10% reward):</span>
                      <span>+{receiptData.pointsChanged} Pts</span>
                    </div>
                  )}
                </div>

                {/* Final Amount To Collect Callout */}
                <div className="p-4 rounded-xl bg-brand-blue/10 border border-brand-blue/30 flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-brand-blue">
                      Final Amount Collected
                    </p>
                    <p className="text-3xl font-extrabold text-ink-dark mt-0.5">
                      ₹{receiptData.payableAmount}
                    </p>
                  </div>
                </div>

                {/* Customer Points Balance Update */}
                <div className="p-4 rounded-xl bg-canvas border border-border-subtle flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-surface-bone flex items-center justify-center text-amber-400">
                      <Coins className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs text-ink-secondary">Updated Member Balance</p>
                      <p className="text-lg font-bold text-ink-dark">{receiptData.newBalance} Pts</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                      <CheckCircle2 className="w-3 h-3" /> Sent to Google Wallet
                    </span>
                  </div>
                </div>

                {/* Start Next Sale Button */}
                <Button onClick={startNextSale} className="w-full py-3 text-sm">
                  Start Next Sale
                </Button>
              </div>
            </div>
          ) : (
            /* Empty State */
            <div className="bg-surface-card border border-border-subtle p-8 sm:p-12 rounded-2xl shadow-sm text-center flex flex-col items-center justify-center min-h-95">
              <div className="w-14 h-14 rounded-2xl bg-surface-bone flex items-center justify-center mx-auto mb-4 text-brand-blue">
                <Receipt className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-bold text-ink-dark mb-1.5">Customer Checkout Receipt</h3>
              <p className="text-xs text-ink-secondary max-w-sm mx-auto leading-relaxed">
                Select a customer and enter the checkout bill on the left to simulate a sale and generate an itemized customer receipt.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
    </div>
  );
}
