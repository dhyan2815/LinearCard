'use client';

import React, { useState } from 'react';
import { Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { Label } from '@/components/ui/Label';

export default function LoginPage() {
  const router = useRouter();
  
  const [currentScreen, setCurrentScreen] = useState<'admin_phone' | 'admin_otp'>('admin_phone');
  const [countryCode, setCountryCode] = useState('+91');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [onboardingPhone, setOnboardingPhone] = useState('');
  const [onboardingOtp, setOnboardingOtp] = useState('');
  const [isMockLoading, setIsMockLoading] = useState(false);
  const [otpError, setOtpError] = useState('');

  const COUNTRIES = [
    { name: 'United States', code: '+1', flag: '🇺🇸' },
    { name: 'Canada', code: '+1', flag: '🇨🇦' },
    { name: 'United Kingdom', code: '+44', flag: '🇬🇧' },
    { name: 'India', code: '+91', flag: '🇮🇳' },
    { name: 'Australia', code: '+61', flag: '🇦🇺' },
    { name: 'Germany', code: '+49', flag: '🇩🇪' },
    { name: 'France', code: '+33', flag: '🇫🇷' },
    { name: 'Brazil', code: '+55', flag: '🇧🇷' },
    { name: 'Japan', code: '+81', flag: '🇯🇵' },
    { name: 'China', code: '+86', flag: '🇨🇳' },
    { name: 'United Arab Emirates', code: '+971', flag: '🇦🇪' },
    { name: 'Singapore', code: '+65', flag: '🇸🇬' },
    { name: 'Mexico', code: '+52', flag: '🇲🇽' },
    { name: 'South Africa', code: '+27', flag: '🇿🇦' },
    { name: 'Nigeria', code: '+234', flag: '🇳🇬' },
    { name: 'Italy', code: '+39', flag: '🇮🇹' },
    { name: 'Spain', code: '+34', flag: '🇪🇸' },
    { name: 'Netherlands', code: '+31', flag: '🇳🇱' },
    { name: 'Sweden', code: '+46', flag: '🇸🇪' },
    { name: 'Switzerland', code: '+41', flag: '🇨🇭' },
  ];

  const filteredCountries = COUNTRIES.filter(c => 
    c.name.toLowerCase().includes(countryCode.toLowerCase()) || 
    c.code.includes(countryCode)
  );

  const slideLeft = {
    hidden: { opacity: 0, x: 20 },
    visible: { opacity: 1, x: 0, transition: { duration: 0.5, type: 'spring' as const, bounce: 0, damping: 20 } },
    exit: { opacity: 0, x: -20, transition: { duration: 0.3 } }
  };

  return (
    <AnimatePresence mode="wait">
      {currentScreen === 'admin_phone' && (
        <motion.main key="admin_phone" initial="hidden" animate="visible" exit="exit" variants={slideLeft} className="flex-1 max-w-md w-full mx-auto px-4 py-12 sm:py-20 flex flex-col items-center justify-center">
           <Card className="p-6 sm:p-8 w-full">
             <h2 className="text-2xl font-semibold tracking-tight mb-2">Admin Login</h2>
             <p className="text-ink-secondary text-sm mb-8">Enter your registered admin phone number to access the dashboard.</p>
             
             <form onSubmit={async (e) => {
               e.preventDefault();
               setIsMockLoading(true);
               try {
                 const res = await fetch('/api/admin/send-otp', {
                   method: 'POST',
                   headers: { 'Content-Type': 'application/json' },
                   body: JSON.stringify({ phone: `${countryCode}${onboardingPhone}` })
                 });
                 const data = await res.json();
                 if (!res.ok || !data.success) throw new Error(data.error);
                 setCurrentScreen('admin_otp');
               } catch (err: any) {
                 alert(err.message || "Failed to send OTP");
               } finally {
                 setIsMockLoading(false);
               }
             }} className="space-y-6">
               <div className="flex flex-col sm:flex-row gap-3 relative">
                 <div className="w-full sm:w-1/3">
                   <Label>Country Code</Label>
                   <Input 
                     type="text" 
                     value={countryCode} 
                     onChange={(e) => {
                       let val = e.target.value;
                       if (/^\d/.test(val)) val = '+' + val;
                       setCountryCode(val);
                       setIsDropdownOpen(true);
                     }}
                     onKeyDown={(e) => {
                       if (e.key === 'Enter' && isDropdownOpen) {
                         e.preventDefault();
                         if (filteredCountries.length > 0) {
                           setCountryCode(filteredCountries[0].code);
                         }
                         setIsDropdownOpen(false);
                       }
                     }}
                     onFocus={() => setIsDropdownOpen(true)}
                     onBlur={() => setTimeout(() => setIsDropdownOpen(false), 200)}
                     placeholder="+1" 
                     required 
                   />
                   {isDropdownOpen && (
                     <div className="absolute z-10 w-full sm:w-64 mt-2 max-h-48 overflow-y-auto bg-surface-card border border-border-subtle rounded-xl shadow-xl custom-scrollbar left-0">
                       {filteredCountries.length > 0 ? filteredCountries.map((c, i) => (
                         <div 
                           key={i} 
                           className="px-4 py-2 hover:bg-surface-bone cursor-pointer flex items-center gap-3 text-sm text-ink-dark transition-colors border-b border-border-subtle/50 last:border-0"
                           onClick={() => {
                             setCountryCode(c.code);
                             setIsDropdownOpen(false);
                           }}
                         >
                           <span className="text-base">{c.flag}</span>
                           <span className="text-brand-blue font-medium w-10">{c.code}</span>
                           <span className="truncate text-ink-secondary">{c.name}</span>
                         </div>
                       )) : (
                         <div className="px-4 py-3 text-sm text-ink-muted italic">
                           Use custom code: {countryCode}
                         </div>
                       )}
                     </div>
                   )}
                 </div>
                 <div className="w-full sm:w-2/3">
                   <Label>Admin Phone Number</Label>
                   <Input type="tel" inputMode="numeric" pattern="[0-9]*" value={onboardingPhone} onChange={(e) => setOnboardingPhone(e.target.value)} placeholder="9876543210" autoFocus required />
                 </div>
               </div>
                 <Button type="submit" disabled={!onboardingPhone || isMockLoading} className="w-full">
                 {isMockLoading ? 'Sending...' : 'Send OTP'}
               </Button>
             </form>
           </Card>
        </motion.main>
      )}

      {currentScreen === 'admin_otp' && (
        <motion.main key="admin_otp" initial="hidden" animate="visible" exit="exit" variants={slideLeft} className="flex-1 max-w-md w-full mx-auto px-4 py-12 sm:py-20 flex flex-col items-center justify-center">
           <Card className="p-6 sm:p-8 w-full">
             <div className="w-10 h-10 bg-brand-blue/10 rounded-xl flex items-center justify-center mb-6 border border-brand-blue/20">
               <Zap className="w-5 h-5 text-brand-blue" />
             </div>
             <h2 className="text-2xl font-semibold tracking-tight mb-2">Verify Admin Access</h2>
             <p className="text-ink-secondary text-sm mb-8">We sent a secure code to <strong className="text-ink-dark font-medium">{countryCode}{onboardingPhone}</strong> via WhatsApp.</p>
             
             <form onSubmit={async (e) => {
               e.preventDefault();
               if (!onboardingOtp) return;
               setIsMockLoading(true);
               try {
                 const res = await fetch('/api/admin/verify-otp', {
                   method: 'POST',
                   headers: { 'Content-Type': 'application/json' },
                   body: JSON.stringify({ phone: `${countryCode}${onboardingPhone}`, otp: onboardingOtp })
                 });
                 const data = await res.json();
                 if (!res.ok || !data.success) throw new Error(data.error);
                 
                 router.push('/dashboard');
               } catch (err: any) {
                 setOtpError(err.message || "Invalid OTP");
                 console.error(err);
               } finally {
                 setIsMockLoading(false);
               }
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
               <Button type="submit" disabled={onboardingOtp.length < 4 || isMockLoading} className="w-full">
                 {isMockLoading ? <span className="flex items-center gap-2"><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/> Authenticating...</span> : 'Login to Dashboard'}
               </Button>
             </form>
           </Card>
        </motion.main>
      )}
    </AnimatePresence>
  );
}
