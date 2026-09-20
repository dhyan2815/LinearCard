'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Palette, Zap, Bell, Users, Settings2, ChevronDown, Check, Menu, Terminal } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useDashboard } from './DashboardContext';

export function DashboardSidebar() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isTenantDropdownOpen, setIsTenantDropdownOpen] = useState(false);
  const pathname = usePathname();

  const { tenants, currentTenant, selectedTenantId, handleTenantChange } = useDashboard();

  const tabs = [
    { id: 'template-designer', path: '/dashboard/template-designer', label: 'Template Designer', icon: <Palette className="w-4 h-4" /> },
    { id: 'live-activity', path: '/dashboard/live-activity', label: 'Live Activity', icon: <Zap className="w-4 h-4" /> },
    { id: 'push-campaigns', path: '/dashboard/push-campaigns', label: 'Push Campaigns', icon: <Bell className="w-4 h-4" /> },
    { id: 'members', path: '/dashboard/members', label: 'Members', icon: <Users className="w-4 h-4" /> },
    { id: 'developers', path: '/dashboard/developers', label: 'Developers', icon: <Terminal className="w-4 h-4" /> },
    { id: 'settings', path: '/dashboard/settings', label: 'Settings', icon: <Settings2 className="w-4 h-4" /> },
  ] as const;

  return (
    <motion.aside 
      initial={false}
      animate={{ width: isSidebarOpen ? 240 : 64 }}
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
               <ChevronDown className={`w-3.5 h-3.5 text-ink-muted shrink-0 transition-transform ${isTenantDropdownOpen ? 'rotate-180' : ''}`} />
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
                         {selectedTenantId === t.id && <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0 ml-2" />}
                       </button>
                     ))}
                   </motion.div>
                 </>
               )}
             </AnimatePresence>
           </div>
         </motion.div>
         <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-1.5 text-ink-secondary hover:text-ink-dark hover:bg-canvas rounded-md transition-colors shrink-0 ml-1">
            <Menu className="w-5 h-5" />
         </button>
      </div>
      <div className="flex-1 py-4 flex flex-col gap-1.5 px-2 overflow-y-auto">
         {tabs.map((tab) => {
           const isActive = pathname === tab.path || pathname.startsWith(tab.path + '/');
           return (
             <Link
                href={tab.path}
                key={tab.id}
                className={`relative flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors overflow-hidden ${
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
      {!isSidebarOpen && (
        <div className="p-3 mt-auto shrink-0 flex justify-center border-t border-border-subtle">
           <div className="w-8 h-8 mx-auto bg-canvas border border-border-subtle rounded-md flex items-center justify-center text-xs font-bold text-ink-dark cursor-help" title={currentTenant?.name}>
              {currentTenant?.name?.charAt(0) || 'T'}
           </div>
        </div>
      )}
    </motion.aside>
  );
}
