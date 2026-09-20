'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Palette, Zap, Bell, Users, Settings2, ChevronDown, Check, Menu, Terminal, User, LogOut, Moon, Sun } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useDashboard } from './DashboardContext';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';

const ICON_STROKE = 1.75;

export function DashboardSidebar() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isTenantDropdownOpen, setIsTenantDropdownOpen] = useState(false);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
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

  const tabs = [
    { id: 'template-designer', path: '/dashboard/template-designer', label: 'Template Designer', icon: <Palette className="w-4 h-4" strokeWidth={ICON_STROKE} /> },
    { id: 'live-activity', path: '/dashboard/live-activity', label: 'Live Activity', icon: <Zap className="w-4 h-4" strokeWidth={ICON_STROKE} /> },
    { id: 'push-campaigns', path: '/dashboard/push-campaigns', label: 'Push Campaigns', icon: <Bell className="w-4 h-4" strokeWidth={ICON_STROKE} /> },
    { id: 'members', path: '/dashboard/members', label: 'Members', icon: <Users className="w-4 h-4" strokeWidth={ICON_STROKE} /> },
    { id: 'developers', path: '/dashboard/developers', label: 'Developers', icon: <Terminal className="w-4 h-4" strokeWidth={ICON_STROKE} /> },
    { id: 'settings', path: '/dashboard/settings', label: 'Settings', icon: <Settings2 className="w-4 h-4" strokeWidth={ICON_STROKE} /> },
  ] as const;

  return (
    <motion.aside
      initial={false}
      animate={{ width: isSidebarOpen ? 280 : 64 }}
      className="flex flex-col border-r border-border-subtle bg-canvas z-20 shrink-0 h-full overflow-hidden"
    >
      <div className="h-16 flex items-center justify-between px-3 border-b border-border-subtle shrink-0">
         <motion.div animate={{ opacity: isSidebarOpen ? 1 : 0, width: isSidebarOpen ? 'auto' : 0 }} className={`whitespace-nowrap overflow-visible ${!isSidebarOpen ? 'pointer-events-none' : ''}`}>
           <div className="relative w-44">
             <button 
               onClick={() => setIsTenantDropdownOpen(!isTenantDropdownOpen)}
               className="hover:bg-surface-hover rounded-md text-[13px] font-semibold text-ink-dark px-2 py-1.5 w-full flex items-center justify-between focus:outline-none transition-colors"
             >
               <span className="truncate pr-2 text-left">{currentTenant?.name || 'Select Tenant'}</span>
               <ChevronDown className={`w-3.5 h-3.5 text-ink-muted shrink-0 transition-transform ${isTenantDropdownOpen ? 'rotate-180' : ''}`} strokeWidth={ICON_STROKE} />
             </button>
             <AnimatePresence>
               {isTenantDropdownOpen && (
                 <>
                   <div className="fixed inset-0 z-40" onClick={() => setIsTenantDropdownOpen(false)} />
                   <motion.div
                     initial={{ opacity: 0, y: -5 }}
                     animate={{ opacity: 1, y: 0 }}
                     exit={{ opacity: 0, y: -5 }}
                     transition={{ duration: 0.15 }}
                     className="absolute top-full left-0 w-52 mt-1 bg-surface-card border border-border-subtle rounded-md shadow-lg z-50 overflow-hidden py-1 flex flex-col"
                   >
                     <span className="text-[10px] uppercase font-semibold text-ink-muted px-3 py-1.5 tracking-wider">Switch Tenant</span>
                     {tenants.map(t => (
                       <button
                         key={t.id}
                         onClick={() => {
                           handleTenantChange(t.id);
                           setIsTenantDropdownOpen(false);
                         }}
                         className="w-full text-left px-3 py-2 text-xs text-ink-dark hover:bg-canvas/80 flex items-center justify-between transition-colors outline-none focus:bg-canvas/80"
                       >
                         <span className="truncate">{t.name}</span>
                         {selectedTenantId === t.id && <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0 ml-2" strokeWidth={ICON_STROKE} />}
                       </button>
                     ))}
                   </motion.div>
                 </>
               )}
             </AnimatePresence>
           </div>
         </motion.div>
         <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-1.5 text-ink-secondary hover:text-ink-dark hover:bg-canvas rounded-md transition-colors shrink-0 ml-1">
            <Menu className="w-5 h-5" strokeWidth={ICON_STROKE} />
         </button>
      </div>
      <div className="flex-1 py-4 flex flex-col gap-1 px-2 overflow-y-auto">
         {tabs.map((tab) => {
           const isActive = pathname === tab.path || pathname.startsWith(tab.path + '/');
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
      {/* Account / Org menu */}
      <div className="p-2 mt-auto shrink-0 border-t border-border-subtle relative">
        <button
          onClick={() => setIsAccountMenuOpen(!isAccountMenuOpen)}
          className={`w-full flex items-center gap-2.5 p-2 rounded-lg hover:bg-surface-hover transition-colors ${!isSidebarOpen ? 'justify-center' : ''}`}
        >
          <div className="w-8 h-8 shrink-0 bg-brand-blue/10 border border-brand-blue/20 rounded-full flex items-center justify-center text-xs font-bold text-brand-blue" title={currentTenant?.name}>
            {currentTenant?.name?.charAt(0) || 'A'}
          </div>
          {isSidebarOpen && (
            <>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-[13px] font-medium text-ink-dark truncate">{currentTenant?.name || 'Admin'}</p>
                <p className="text-[11px] text-ink-muted truncate">Administrator</p>
              </div>
              <ChevronDown className={`w-3.5 h-3.5 text-ink-muted shrink-0 transition-transform ${isAccountMenuOpen ? 'rotate-180' : ''}`} strokeWidth={ICON_STROKE} />
            </>
          )}
        </button>
        <AnimatePresence>
          {isAccountMenuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setIsAccountMenuOpen(false)} />
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 5 }}
                transition={{ duration: 0.15 }}
                className="absolute bottom-full left-2 right-2 mb-1 bg-surface-card border border-border-subtle rounded-md shadow-lg z-50 overflow-hidden py-1"
              >
                <Link href="/dashboard/settings" onClick={() => setIsAccountMenuOpen(false)} className="w-full text-left px-3 py-2 text-xs text-ink-dark hover:bg-canvas/80 flex items-center gap-2 transition-colors">
                  <User className="w-3.5 h-3.5" strokeWidth={ICON_STROKE} /> Profile
                </Link>
                <button onClick={toggleTheme} className="w-full text-left px-3 py-2 text-xs text-ink-dark hover:bg-canvas/80 flex items-center gap-2 transition-colors">
                  {isDarkMode ? <Sun className="w-3.5 h-3.5" strokeWidth={ICON_STROKE} /> : <Moon className="w-3.5 h-3.5" strokeWidth={ICON_STROKE} />}
                  {isDarkMode ? 'Light Mode' : 'Dark Mode'}
                </button>
                <button onClick={handleLogout} className="w-full text-left px-3 py-2 text-xs text-red-500 hover:bg-canvas/80 flex items-center gap-2 transition-colors">
                  <LogOut className="w-3.5 h-3.5" strokeWidth={ICON_STROKE} /> Logout
                </button>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </motion.aside>
  );
}
