'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Zap, ShieldCheck, AlertCircle } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { Label } from '@/components/ui/Label';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

/**
 * Phase 3.6 — one enrollment flow behind two routes:
 * `/enroll/:tenantSlug/:programSlug` picks a specific program, and the older
 * `/enroll/:tenantSlug` resolves to the tenant's default program so links
 * already in the wild keep working.
 */
/** FE-5: India-first. The list is deliberately short - this is a POC. */
const COUNTRIES = [
  { name: 'India', code: '+91', flag: '🇮🇳' },
  { name: 'United States', code: '+1', flag: '🇺🇸' },
  { name: 'United Kingdom', code: '+44', flag: '🇬🇧' },
  { name: 'Australia', code: '+61', flag: '🇦🇺' },
  { name: 'Germany', code: '+49', flag: '🇩🇪' },
  { name: 'Singapore', code: '+65', flag: '🇸🇬' },
  { name: 'United Arab Emirates', code: '+971', flag: '🇦🇪' },
];

export default function EnrollFlow() {
  const params = useParams();
  const slug = params.slug as string;
  const programSlug = params.programSlug as string | undefined;

  const [tenantConfig, setTenantConfig] = useState<any>(null);
  const [tenantError, setTenantError] = useState<string | null>(null);

  const [currentScreen, setCurrentScreen] = useState<'loading' | 'error' | 'consumer_phone' | 'consumer_otp' | 'consumer_success'>('loading');
  const [proximityTipDismissed, setProximityTipDismissed] = useState(false);
  const [countryCode, setCountryCode] = useState('+91');
  const [onboardingName, setOnboardingName] = useState('');
  const [onboardingPhone, setOnboardingPhone] = useState('');
  const [onboardingOtp, setOnboardingOtp] = useState('');
  const [consentGiven, setConsentGiven] = useState(false);
  const [isMockLoading, setIsMockLoading] = useState(false);
  const [otpError, setOtpError] = useState('');

  useEffect(() => {
    async function fetchTenant() {
      try {
        const data = await apiClient(`/tenant/${slug}`);
        // If the tenant isn't found or an error occurred, block the enrollment flow
        if (data.error) {
          setTenantError('This enrollment link is invalid. Please ask the brand for their correct link.');
          setCurrentScreen('error');
        } else {
          // A program slug in the URL must resolve, or the customer would be
          // silently enrolled into a different program than the QR promised.
          const programs = data.programs || [];
          const program = programSlug
            ? programs.find((p: any) => p.enrollmentSlug === programSlug)
            : programs.find((p: any) => p.id === data.defaultProgramId);
          if (programSlug && !program) {
            setTenantError('This program link is invalid or has been retired.');
            setCurrentScreen('error');
            return;
          }
          setTenantConfig({ ...data, program });
          setCurrentScreen('consumer_phone');
        }
      } catch (err) {
        setTenantError('Failed to load brand data.');
        setCurrentScreen('error');
      }
    }
    fetchTenant();
  }, [slug, programSlug]);

  const [generatedPassUrl, setGeneratedPassUrl] = useState<string | null>(null);

  const getWalletUrl = () => {
    return generatedPassUrl || '#';
  };

  const slideLeft = {
    hidden: { opacity: 0, x: 20 },
    visible: { opacity: 1, x: 0, transition: { duration: 0.5, type: 'spring' as const, bounce: 0, damping: 20 } },
    exit: { opacity: 0, x: -20, transition: { duration: 0.3 } }
  };

  if (currentScreen === 'loading') {
    return (
      <main className="flex-1 w-full mx-auto px-4 py-20 flex flex-col items-center justify-center">
        <div className="w-8 h-8 border-4 border-brand-blue/30 border-t-brand-blue rounded-full animate-spin" />
      </main>
    );
  }

  if (currentScreen === 'error') {
    return (
      <main className="flex-1 max-w-md w-full mx-auto px-4 py-20 flex flex-col items-center justify-center text-center">
        <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-red-500/20 shadow-lg">
          <AlertCircle className="w-8 h-8 text-red-500" />
        </div>
        <h2 className="text-2xl font-semibold tracking-tight mb-3">Link Invalid</h2>
        <p className="text-ink-secondary text-base">{tenantError}</p>
      </main>
    );
  }

  return (
    <AnimatePresence mode="wait">
      {currentScreen === 'consumer_phone' && (
        <motion.main key="consumer_phone" initial="hidden" animate="visible" exit="exit" variants={slideLeft} className="flex-1 max-w-md w-full mx-auto px-4 py-12 sm:py-20 flex flex-col items-center justify-center">
          <Card className="p-6 sm:p-8 w-full">
            <h2 className="text-2xl font-semibold tracking-tight mb-2">Claim your pass</h2>
            <p className="text-ink-secondary text-sm mb-8">Enter your phone number to authenticate via WhatsApp.</p>

            <form onSubmit={async (e) => {
              e.preventDefault();
              setIsMockLoading(true);

              toast.promise(
                apiClient('/auth/send-otp', {
                  method: 'POST',
                  body: JSON.stringify({
                    phone: `${countryCode}${onboardingPhone}`,
                    tenantId: tenantConfig.tenantId,
                    programId: tenantConfig.program?.id
                  })
                }).then((data) => {
                  if (!data.success) throw new Error(data.error);
                  setCurrentScreen('consumer_otp');
                  return data;
                }),
                {
                  loading: 'Sending OTP via WhatsApp...',
                  success: 'OTP sent successfully!',
                  error: (err: any) => err.message || "Failed to send OTP",
                  finally: () => setIsMockLoading(false)
                }
              );
            }} className="space-y-6">
              <div className="space-y-1">
                <Label>Full Name</Label>
                <Input type="text" value={onboardingName} onChange={(e) => setOnboardingName(e.target.value)} placeholder="Jane Doe" autoFocus required />
              </div>
              <div className="flex flex-row gap-3">
                {/* Phase 6.6 (FE-5) - India-first, and a native <select> the
                    phone renders as its own picker. The old control was a
                    free-text box with a hand-rolled text-match dropdown that
                    accepted any string as a dialling code. */}
                <div className="w-[34%] sm:w-1/3 space-y-1">
                  <Label>Country</Label>
                  <select
                    value={countryCode}
                    onChange={(e) => setCountryCode(e.target.value)}
                    className="w-full h-10 bg-surface-bone border border-border-strong rounded-lg px-2 text-sm text-ink-dark focus:outline-none focus:border-brand-blue"
                    required
                  >
                    {COUNTRIES.map((c) => (
                      <option key={c.name} value={c.code}>
                        {c.flag} {c.code}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex-1 sm:w-2/3 space-y-1">
                  <Label>Phone Number</Label>
                  <Input type="tel" inputMode="numeric" pattern="[0-9]*" value={onboardingPhone} onChange={(e) => setOnboardingPhone(e.target.value)} placeholder="(555) 000-0000" required />
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 bg-surface-card rounded-xl border border-border-subtle">
                <input type="checkbox" id="consent" checked={consentGiven} onChange={(e) => setConsentGiven(e.target.checked)} className="mt-1 w-4 h-4 rounded text-brand-blue focus:ring-brand-blue border-border-strong bg-surface-bone" required />
                <label htmlFor="consent" className="text-xs font-medium text-ink-secondary cursor-pointer leading-relaxed">
                  I consent to receiving WhatsApp messages and agree to the DPDP guidelines for digital identity verification.
                </label>
              </div>
              <Button type="submit" disabled={!onboardingName || !onboardingPhone || !consentGiven || isMockLoading} className="w-full" style={{ backgroundColor: tenantConfig.brandHexColor }}>
                {isMockLoading ? 'Sending...' : 'Send OTP'}
              </Button>
            </form>
          </Card>
        </motion.main>
      )}

      {currentScreen === 'consumer_otp' && (
        <motion.main key="consumer_otp" initial="hidden" animate="visible" exit="exit" variants={slideLeft} className="flex-1 max-w-md w-full mx-auto px-4 py-12 sm:py-20 flex flex-col items-center justify-center">
          <Card className="p-6 sm:p-8 w-full">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-6 border" style={{ backgroundColor: `${tenantConfig.brandHexColor}1A`, borderColor: `${tenantConfig.brandHexColor}33` }}>
              <Zap className="w-5 h-5" style={{ color: tenantConfig.brandHexColor }} />
            </div>
            <h2 className="text-2xl font-semibold tracking-tight mb-2">Verify it's you</h2>
            <p className="text-ink-secondary text-sm mb-8">We sent a secure code to <strong className="text-ink-dark font-medium">{countryCode}{onboardingPhone}</strong> via WhatsApp.</p>

            <form onSubmit={async (e) => {
              e.preventDefault();
              // Prevent submission if consent is missing or OTP input is empty
              if (!consentGiven || !onboardingOtp) return;
              setIsMockLoading(true);

              toast.promise(
                apiClient('/auth/verify-otp', {
                  method: 'POST', body: JSON.stringify({
                    phone: `${countryCode}${onboardingPhone}`,
                    otp: onboardingOtp,
                    consentGiven,
                    tenantId: tenantConfig.tenantId,
                    programId: tenantConfig.program?.id,
                    memberName: onboardingName,
                    // AUTH-4: barcode payload and alt text are derived from the
                    // passId server-side. Never send the phone number — the
                    // barcode is publicly scannable.
                  })
                }).then((data) => {
                  if (!data.success) throw new Error(data.error);
                  setGeneratedPassUrl(data.googleWalletUrl);
                  setCurrentScreen('consumer_success');
                  return data;
                }),
                {
                  loading: 'Verifying and generating pass...',
                  success: 'Pass generated successfully!',
                  error: (err: any) => {
                    setOtpError(err.message || "Demo API error");
                    return err.message || "Demo API error";
                  },
                  finally: () => setIsMockLoading(false)
                }
              );
            }} className="space-y-6">
              <div className="space-y-2">
                <Input type="text" inputMode="numeric" pattern="[0-9]*" value={onboardingOtp} onChange={(e) => {
                  setOnboardingOtp(e.target.value);
                  setOtpError('');
                }} placeholder="0 0 0 0" className={`text-center tracking-[1em] text-xl font-medium ${otpError ? 'border-red-500/50 focus-visible:ring-red-500/50' : ''}`} maxLength={4} autoFocus required />
                {otpError && (
                  <p className="text-red-500 text-sm text-center font-medium animate-in fade-in slide-in-from-top-1">
                    {otpError}
                  </p>
                )}
              </div>
              <Button type="submit" disabled={onboardingOtp.length < 4 || isMockLoading} className="w-full" style={{ backgroundColor: tenantConfig.brandHexColor }}>
                {isMockLoading ? <span className="flex items-center gap-2"><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Generating Pass...</span> : 'Verify & Generate Pass'}
              </Button>
            </form>
          </Card>
        </motion.main>
      )}

      {currentScreen === 'consumer_success' && (
        <motion.main
          key="consumer_success"
          initial="hidden"
          animate="visible"
          variants={slideLeft}
          className="flex-1 max-w-md w-full mx-auto px-4 py-8 sm:py-16 flex flex-col items-center justify-center min-h-[80vh]"
          onAnimationComplete={() => {
            try {
              confetti({
                particleCount: 100,
                spread: 70,
                origin: { y: 0.4 },
                colors: [tenantConfig?.brandHexColor || '#ff4500', '#10b981', '#3b82f6', '#f59e0b']
              });
            } catch (e) {
              console.error('Confetti error:', e);
            }
          }}
        >
          <Card className="p-6 sm:p-8 w-full flex flex-col items-center text-center relative overflow-hidden">
            {/* Decorative background glows */}
            <div className="absolute -top-24 -right-24 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-brand-blue/10 rounded-full blur-3xl pointer-events-none" />

            <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mb-6 border border-emerald-500/20 shadow-inner relative z-10">
              <ShieldCheck className="w-10 h-10 text-emerald-500" />
            </div>

            <h2 className="text-2xl font-bold tracking-tight text-ink-dark mb-3 relative z-10">
              Pass is Live!
            </h2>

            <p className="text-ink-secondary text-sm mb-8 leading-relaxed relative z-10 max-w-xs mx-auto">
              Identity verified successfully. Scan the QR code or tap the button below to save your digital pass instantly to Google Wallet.
            </p>

            <div className="relative z-10 mb-8 flex justify-center">
              <a
                href={getWalletUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-white p-3 rounded-2xl shadow-sm border border-black/5 hover:scale-105 transition-transform cursor-pointer block"
                title="Click or scan to add to Google Wallet"
              >
                <QRCodeSVG
                  value={getWalletUrl()}
                  size={220}
                  level="L"
                  includeMargin={true}
                  className="rounded-lg"
                />
              </a>
            </div>

            <div className="w-full relative z-10 space-y-4">
              <a
                href={getWalletUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 bg-[#1f1f1f] hover:bg-[#2d2d2d] text-white py-3.5 px-4 rounded-xl transition-all shadow-lg hover:shadow-xl active:scale-[0.98] border border-white/5"
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335" />
                </svg>
                <span className="font-semibold text-[15px]">Add to Google Wallet</span>
              </a>

              <button
                onClick={() => {
                  navigator.clipboard.writeText(getWalletUrl());
                  toast.success('Pass Link Copied!');
                }}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 text-sm font-medium text-ink-secondary hover:text-ink-dark transition-colors rounded-xl hover:bg-surface-bone"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                  <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                </svg>
                Copy Link Manually
              </button>

              {/* Phase 4.2 — Google's proximity notifications only fire if the
                  member turns them on inside the Wallet app. Nothing else in
                  the product tells them, so this one line is the highest-yield
                  thing available on the Google side. */}
              {!proximityTipDismissed && (
                <div className="flex items-start gap-2 text-left text-xs text-ink-secondary bg-surface-bone rounded-xl p-3">
                  <span className="flex-1">
                    Want a nudge when you&apos;re near us? In Google Wallet, open
                    Settings and turn on notifications for nearby passes.{' '}
                    <a
                      href="https://support.google.com/wallet/answer/12059409"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline font-medium"
                    >
                      How to enable
                    </a>
                  </span>
                  <button
                    type="button"
                    onClick={() => setProximityTipDismissed(true)}
                    className="text-ink-muted hover:text-ink-dark shrink-0"
                    aria-label="Dismiss"
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>
          </Card>
        </motion.main>
      )}
    </AnimatePresence>
  );
}
