'use client';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Settings2, Zap, Menu, Palette, Bell, Users } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import PassPreviewCard from '@/components/PassPreviewCard';

import { LiveManageView } from './_components/LiveManageView';
import { TemplateWorkspace } from './_components/TemplateWorkspace';
import { BroadcastView } from './_components/BroadcastView';
import { SettingsView } from './_components/SettingsView';
import { MembersView } from './_components/MembersView';

type Archetype = 'loyalty' | 'membership' | 'id_card' | 'access_badge';

function WalletStatusPill({ label, status }: { label: string; status: string }) {
  const colors: Record<string, string> = {
    connected: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    not_configured: 'bg-zinc-500/10 text-ink-muted border-border-subtle',
    pending_approval: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    loading: 'bg-zinc-500/10 text-ink-muted border-border-subtle',
  };
  const dot: Record<string, string> = {
    connected: 'bg-emerald-500 animate-pulse',
    not_configured: 'bg-zinc-400',
    pending_approval: 'bg-amber-500',
    loading: 'bg-zinc-400',
  };
  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] uppercase tracking-wide font-semibold border ${colors[status] || colors.not_configured}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot[status] || dot.not_configured}`} />
      {label}: {(status || 'loading').replace(/_/g, ' ')}
    </div>
  );
}

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<'design' | 'manage' | 'notify' | 'members' | 'settings'>('design');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const [tenants, setTenants] = useState<any[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<string>('');
  const [origin, setOrigin] = useState<string>('');
  const [stats, setStats] = useState<{
    memberCount: number;
    passCount: number;
    walletStatus: { google: string; apple: string; samsung: string };
    tierDistribution: Record<string, number>;
  }>({
    memberCount: 0,
    passCount: 0,
    walletStatus: { google: 'loading', apple: 'not_configured', samsung: 'not_configured' },
    tierDistribution: {}
  });

  const [designData, setDesignData] = useState({
    classSuffix: '',
    archetype: 'loyalty' as Archetype,
    cardTitle: '',
    hexBackgroundColor: '#1A365D',
    logoUrl: '',
    heroImageUrl: '',
    rows: [
      { id: 'row1', columns: [{ header: 'Points', body: '500' }, { header: 'Tier', body: 'Gold' }] }
    ]
  });
  
  const [savedTemplateId, setSavedTemplateId] = useState<string | null>(null);
  const [templateStatus, setTemplateStatus] = useState<'unsaved' | 'draft' | 'published'>('unsaved');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setOrigin(window.location.origin);
    }
    fetch('/api/tenants')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.tenants && data.tenants.length > 0) {
          setTenants(data.tenants);
          setSelectedTenantId(data.tenants[0].id);
        }
      });
  }, []);

  const currentTenant = tenants.find(t => t.id === selectedTenantId);

  useEffect(() => {
    if (selectedTenantId) {
      fetch(`/api/dashboard/stats?tenantId=${selectedTenantId}`)
        .then(res => res.json())
        .then(data => {
           if (data.success) {
             setStats(data.stats);
           }
        });
        
      fetch(`/api/members?tenantId=${selectedTenantId}`)
        .then(res => res.json())
        .then(data => {
          if (data.success) {
             const allPasses = data.members?.flatMap((m: any) => m.passes?.map((p: any) => ({
                memberId: m.id,
                passData: { memberName: m.name || m.phone, ...p },
                passId: p.id,
                fullPassId: p.id
             })) || []) || [];
             setPassHistory(allPasses);
          }
        });
    }
  }, [selectedTenantId]);

  const handleTenantChange = (newTenantId: string) => {
    setSelectedTenantId(newTenantId);
    setActiveTab('design');
    setManageData({ passId: '', balance: '', tier: '', pushNotification: '', phone: '', brandName: '' });
  };

  useEffect(() => {
    if (currentTenant) {
      fetch(`/api/templates?tenantId=${currentTenant.id}`)
        .then(res => res.json())
        .then(data => {
          if (data.success && data.templates && data.templates.length > 0) {
            const t = data.templates[0];
            setSavedTemplateId(t.id);
            setTemplateStatus(t.status || 'draft');
            setDesignData({
              classSuffix: t.classSuffix,
              archetype: t.archetype,
              cardTitle: t.title || t.name,
              hexBackgroundColor: t.hexBackgroundColor,
              logoUrl: t.logoUrl || '',
              heroImageUrl: t.heroImageUrl || '',
              rows: t.fieldRows || [{ id: 'row1', columns: [{ header: 'Points', body: '500' }, { header: 'Tier', body: 'Gold' }] }]
            });
          } else {
            setSavedTemplateId(null);
            setTemplateStatus('unsaved');
          }
        })
        .catch(err => {
          console.error('Error fetching templates:', err);
          setSavedTemplateId(null);
          setTemplateStatus('unsaved');
        });
    }
  }, [currentTenant]);

  const [manageData, setManageData] = useState({
    passId: '', balance: '', tier: '', pushNotification: '', phone: '', brandName: ''
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [passHistory, setPassHistory] = useState<any[]>([]);

  const handleUpdatePass = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError(null); setSuccessMsg(null);
    try {
      const response = await fetch('/api/update-pass', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(manageData)
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Failed to update pass');
      
      let msg = `Pass updated successfully! Changes pushed to your device.`;
      if (manageData.pushNotification) msg += ` Notification sent: "${manageData.pushNotification}"`;
      setSuccessMsg(msg);
      
      setPassHistory(prev => prev.map(p => {
        if (p.passId === manageData.passId || p.fullPassId === manageData.passId) {
          return { ...p, passData: { ...p.passData, balance: manageData.balance, tier: manageData.tier }};
        }
        return p;
      }));
    } catch (err: any) { setError(err.message); } finally { setLoading(false); }
  };

  const selectPassForManage = (pass: any) => {
    setManageData(prev => ({
      ...prev,
      passId: pass.fullPassId || pass.passId,
      balance: pass.passData?.balance || '',
      tier: pass.passData?.tier || '',
      pushNotification: ''
    }));
    setSuccessMsg(null); setError(null);
  };

  const tabs = [
    { id: 'design', label: 'Template Canvas', icon: <Palette className="w-4 h-4" /> },
    { id: 'manage', label: 'Live Updates', icon: <Zap className="w-4 h-4" /> },
    { id: 'notify', label: 'Broadcasts', icon: <Bell className="w-4 h-4" /> },
    { id: 'members', label: 'Members', icon: <Users className="w-4 h-4" /> },
    { id: 'settings', label: 'Settings', icon: <Settings2 className="w-4 h-4" /> },
  ] as const;

  return (
    <div className="flex flex-1 h-full overflow-hidden bg-canvas">
      {/* LEFT SIDEBAR (Collapsible) */}
      <motion.aside 
        initial={false}
        animate={{ width: isSidebarOpen ? 240 : 64 }}
        className="flex flex-col border-r border-border-subtle bg-canvas z-20 shrink-0 h-full"
      >
        <div className="h-16 flex items-center justify-between px-3 border-b border-border-subtle shrink-0">
           <motion.div animate={{ opacity: isSidebarOpen ? 1 : 0, width: isSidebarOpen ? 'auto' : 0 }} className="whitespace-nowrap overflow-hidden ml-1">
             <span className="font-semibold text-ink-dark text-[13px] tracking-wide uppercase">Workspace</span>
           </motion.div>
           <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-1.5 text-ink-secondary hover:text-ink-dark hover:bg-canvas rounded-md transition-colors shrink-0">
              <Menu className="w-5 h-5" />
           </button>
        </div>
        <div className="flex-1 py-4 flex flex-col gap-1.5 px-2 overflow-y-auto">
           {tabs.map((tab) => (
             <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors overflow-hidden ${
                  activeTab === tab.id 
                    ? 'bg-brand-blue/10 text-brand-blue' 
                    : 'text-ink-secondary hover:bg-canvas hover:text-ink-dark'
                }`}
             >
                <div className="shrink-0">{tab.icon}</div>
                <motion.span 
                  animate={{ opacity: isSidebarOpen ? 1 : 0, width: isSidebarOpen ? 'auto' : 0 }} 
                  className="text-[13px] font-medium whitespace-nowrap overflow-hidden text-left"
                >
                  {tab.label}
                </motion.span>
             </button>
           ))}
        </div>
        <div className="p-3 border-t border-border-subtle mt-auto overflow-hidden shrink-0">
           {isSidebarOpen ? (
             <div className="flex flex-col gap-1.5">
               <span className="text-[10px] uppercase font-semibold text-ink-muted px-1 tracking-wider">Active Tenant</span>
               <select value={selectedTenantId} onChange={(e) => handleTenantChange(e.target.value)} className="bg-canvas border border-border-subtle rounded-md text-xs text-ink-dark p-2 w-full focus:outline-none focus:border-brand-blue cursor-pointer">
                  {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
               </select>
             </div>
           ) : (
             <div className="w-8 h-8 mx-auto bg-canvas border border-border-subtle rounded-md flex items-center justify-center text-xs font-bold text-ink-dark cursor-help" title={currentTenant?.name}>
                {currentTenant?.name?.charAt(0) || 'T'}
             </div>
           )}
        </div>
      </motion.aside>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col min-w-0 bg-canvas">
         {/* WORKSPACE */}
         <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
           <AnimatePresence mode="wait">
             <motion.div 
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="h-full"
             >
               {activeTab === 'design' && (
                 <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 lg:gap-12 max-w-[1600px] mx-auto">
                    <div className="xl:col-span-7 flex flex-col gap-6">
                      <TemplateWorkspace 
                          designData={designData}
                          setDesignData={setDesignData}
                          origin={origin}
                          templateStatus={templateStatus}
                          savedTemplateId={savedTemplateId}
                          setSavedTemplateId={setSavedTemplateId}
                          setTemplateStatus={setTemplateStatus}
                          currentTenant={currentTenant}
                          selectedTenantId={selectedTenantId}
                      />
                    </div>
                    <div className="xl:col-span-5 flex justify-center xl:justify-start xl:pl-12 xl:sticky xl:top-0">
                      <motion.div whileHover={{ scale: 1.02, rotateY: -2, rotateX: 2 }} transition={{ type: "spring", stiffness: 200, damping: 20 }} className="w-full sm:w-[320px]">
                        <PassPreviewCard
                          memberName={manageData.passId ? 'Live Pass' : 'Dhyan Patel'}
                          cardTitle={designData.cardTitle}
                          hexBackgroundColor={designData.hexBackgroundColor}
                          barcodeAltText={'882190'}
                          barcodeValue={'https://linearcard.vercel.app/member/882190'}
                          logoUrl={designData.logoUrl}
                          heroImageUrl={designData.heroImageUrl}
                          rows={designData.rows}
                          manageTier={manageData.tier}
                          manageBalance={manageData.balance}
                          isManageTab={!!manageData.passId}
                        />
                      </motion.div>
                    </div>
                 </div>
               )}

               {activeTab === 'manage' && (
                 <div className="max-w-[1600px] mx-auto">
                   <LiveManageView 
                      tenantId={selectedTenantId}
                      manageData={manageData}
                      setManageData={setManageData}
                      handleUpdatePass={handleUpdatePass}
                      loading={loading}
                      error={error}
                      successMsg={successMsg}
                      passHistory={passHistory}
                      selectPassForManage={selectPassForManage}
                   />
                 </div>
               )}

               {activeTab === 'notify' && (
                 <div className="max-w-[1600px] mx-auto">
                    <BroadcastView tenantId={selectedTenantId} />
                 </div>
               )}

               {activeTab === 'settings' && (
                 <div className="max-w-[1600px] mx-auto">
                    <SettingsView />
                 </div>
               )}
             </motion.div>
           </AnimatePresence>
         </main>
      </div>
    </div>
  );
}
