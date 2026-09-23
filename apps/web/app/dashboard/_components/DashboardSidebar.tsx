'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Layers, Palette, Zap, Bell, Users, Settings2, ChevronDown, Check, Menu, Terminal, User, LogOut, Moon, Sun, CreditCard, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useDashboard } from './DashboardContext';
import { ProgramSidebar } from './ProgramNav';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';

const ICON_STROKE = 1.75;

export function DashboardSidebar() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  const { tenants, currentTenant, selectedTenantId, handleTenantChange } = useDashboard();

  useEffect(() => {
    setIsDarkMode(!document.documentElement.classList.contains('light'));
  }, []);

  const toggleTheme = () => {
    document.documentElement.classList.toggle('light');
    const nowLight = document.documentElement.classList.contains('light');
    setIsDarkMode(!nowLight);
    try {
      localStorage.setItem('theme', nowLight ? 'light' : 'dark');
    } catch {}
  };

  const handleLogout = async () => {
    try {
      await apiClient('/auth/admin/logout', { method: 'POST' });
    } finally {
      router.push('/login');
    }
  };

  // Phase 8 — two-level nav. Everything program-scoped (design, campaigns,
  // activity, members) now lives on the program's own tab strip, so the
  // sidebar carries only account-level destinations.
  const tabs = [
    { id: 'programs', path: '/dashboard', label: 'Projects', icon: <Layers className="w-4 h-4" strokeWidth={ICON_STROKE} /> },
    { id: 'developers', path: '/dashboard/developers', label: 'Developers', icon: <Terminal className="w-4 h-4" strokeWidth={ICON_STROKE} /> },
    { id: 'settings', path: '/dashboard/settings', label: 'Settings', icon: <Settings2 className="w-4 h-4" strokeWidth={ICON_STROKE} /> },
  ] as const;

  // Phase 8 — inside a program the program's own nav renders as a second
  // column nested beside this one.
  const programId = pathname?.match(/^\/dashboard\/programs\/([^/]+)/)?.[1];
  const showProgramSidebar = !!programId && programId !== 'new';

  return (
    <>
    <motion.aside
      initial={false}
      animate={{ width: isSidebarOpen ? 200 : 64 }}
      className="flex flex-col border-r border-border-subtle bg-canvas z-20 shrink-0 h-full relative"
    >
      {/* Toggle Button */}
      <button 
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        className="absolute top-7 -right-3 w-6 h-6 bg-surface-card border border-border-subtle rounded-full flex items-center justify-center text-ink-secondary hover:text-ink-dark hover:bg-surface-hover shadow-sm z-50 transition-colors focus:outline-none"
      >
        {isSidebarOpen ? <ChevronLeft className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
      </button>

      <div className="flex-1 py-4 flex flex-col gap-1 px-2 overflow-y-auto">
         {tabs.map((tab) => {
           // '/dashboard' is a prefix of every dashboard route, so Projects
           // matches the gallery and the program routes explicitly instead.
           const isActive = tab.path === '/dashboard'
             ? pathname === '/dashboard' || pathname.startsWith('/dashboard/programs')
             : pathname === tab.path || pathname.startsWith(tab.path + '/');
           return (
             <Link
                href={tab.path}
                key={tab.id}
                className={`relative flex items-center gap-3 p-2 rounded-lg transition-colors overflow-hidden ${
                  isActive
                    ? 'bg-brand-blue/10 text-brand-blue font-medium'
                    : 'text-ink-secondary hover:bg-surface-hover hover:text-ink-dark'
                }`}
             >
                {isActive && (
                  <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full bg-brand-blue" />
                )}
                <div className="shrink-0">{tab.icon}</div>
                <motion.span 
                  animate={{ opacity: isSidebarOpen ? 1 : 0, width: isSidebarOpen ? 'auto' : 0 }} 
                  className="text-[13px] font-medium whitespace-nowrap overflow-hidden text-left"
                >
                  {tab.label}
                </motion.span>
             </Link>
           );
         })}
      </div>

    </motion.aside>
    {showProgramSidebar && <ProgramSidebar programId={programId!} />}
    </>
  );
}
