'use client';

import React, { useState, useEffect } from 'react';
import { Palette, Zap, RefreshCw, ArrowRight, ExternalLink, CheckCircle2, AlertCircle, Plus, X, QrCode } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { motion, AnimatePresence } from 'motion/react';
import PassPreviewCard from '@/components/PassPreviewCard';
import Link from 'next/link';
import { Button, buttonVariants, buttonBaseClass } from '@/components/ui/Button';
import { clsx } from 'clsx';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { Label } from '@/components/ui/Label';

const COLOR_PALETTE = [
  { name: 'Obsidian', hex: '#18181B' },
  { name: 'Midnight', hex: '#0F172A' },
  { name: 'Deep Navy', hex: '#1A365D' },
  { name: 'Indigo Aura', hex: '#1E1B4B' },
  { name: 'Dark Emerald', hex: '#064E3B' },
  { name: 'Espresso', hex: '#38220F' },
  { name: 'Crimson Velvet', hex: '#4C0519' },
  { name: 'Royal Purple', hex: '#3B0764' }
];

const ARCHETYPES = [
  { value: 'loyalty',      label: 'Loyalty Pass' },
  { value: 'membership',   label: 'Membership Card' },
  { value: 'id_card',      label: 'ID Card' },
  { value: 'access_badge', label: 'Access Badge' },
] as const;
type Archetype = typeof ARCHETYPES[number]['value'];

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<'design' | 'issue' | 'manage'>('design');
  const [tenants, setTenants] = useState<any[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<string>('');
  const [origin, setOrigin] = useState<string>('');
  const [stats, setStats] = useState({ memberCount: 0, passCount: 0, walletStatus: 'Loading...' });

  const currentTenant = tenants.find(t => t.id === selectedTenantId);

  useEffect(() => {
    fetch('/api/dashboard/stats')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setStats({
            memberCount: data.memberCount,
            passCount: data.passCount,
            walletStatus: data.walletStatus
          });
        }
      });
  }, []);

  useEffect(() => {
    setOrigin('https://linearcard.vercel.app');
    fetch('/api/tenants').then(res => res.json()).then(data => {
      // Auto-select the first tenant if available to pre-fill the form
      if (data.success && data.tenants.length > 0) {
        setTenants(data.tenants);
        const initial = data.tenants[0];
        setSelectedTenantId(initial.id);
        setDesignData(prev => ({
          ...prev,
          classSuffix: initial.classSuffix,
          cardTitle: initial.name,
          hexBackgroundColor: initial.brandHexColor,
          logoUrl: initial.logoUrl,
          heroImageUrl: initial.heroUrl,
        }));
      }
    });
  }, []);

  const handleTenantChange = (tenantId: string) => {
    setSelectedTenantId(tenantId);
    const tenant = tenants.find(t => t.id === tenantId);
    if (tenant) {
      setDesignData(prev => ({
        ...prev,
        classSuffix: tenant.classSuffix,
        cardTitle: tenant.name,
        hexBackgroundColor: tenant.brandHexColor,
        logoUrl: tenant.logoUrl,
        heroImageUrl: tenant.heroUrl,
      }));
    }
  };

  const [designData, setDesignData] = useState({
    classSuffix: 'linearcard_sandbox_class',
    archetype: 'loyalty' as Archetype,
    cardTitle: 'The SkyHigh Alliance',
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
    if (activeTab === 'design' && currentTenant) {
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
  }, [activeTab, currentTenant]);

  const [manageData, setManageData] = useState({
    passId: '',
    balance: '',
    tier: '',
    pushNotification: '',
    phone: '',
    brandName: ''
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [generatedPassUrl, setGeneratedPassUrl] = useState<string | null>(null);
  const [passHistory, setPassHistory] = useState<any[]>([]);

  const [devSettings, setDevSettings] = useState({ apiKey: '' });

  const getWalletUrl = (url: string | null) => {
    return url || '#';
  };

  const loadDeveloperSettings = async () => {
    try {
      const res = await fetch('/api/admin/developer-settings');
      const data = await res.json();
      // Populate API key field only if the API call succeeds
      if (data.success) {
        setDevSettings({ apiKey: data.apiKey || 'No API Key generated yet.' });
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (activeTab === 'manage' || activeTab === 'design' || activeTab === 'issue') {
      // Nothing special here
    } else if (activeTab === 'developer' as any) {
      loadDeveloperSettings();
    }
  }, [activeTab]);

  const addRow = () => {
    // Limit to 3 rows max as dictated by Google Wallet's layout constraints
    if (designData.rows.length >= 3) return;
    setDesignData({
      ...designData, 
      rows: [...designData.rows, { id: `row${Date.now()}`, columns: [{ header: 'New Field', body: 'Value' }] }]
    });
  };

  const removeRow = (rowId: string) => {
    setDesignData({ ...designData, rows: designData.rows.filter(r => r.id !== rowId) });
  };

  const addColumn = (rowId: string) => {
    const newRows = designData.rows.map(r => {
      // Limit columns to 3 per row to prevent text overlap in the mobile wallet
      if (r.id === rowId && r.columns.length < 3) {
        return { ...r, columns: [...r.columns, { header: 'New Field', body: 'Value' }] };
      }
      return r;
    });
    setDesignData({ ...designData, rows: newRows });
  };

  const updateColumn = (rowId: string, colIndex: number, field: 'header' | 'body', value: string) => {
    const newRows = designData.rows.map(r => {
      if (r.id === rowId) {
        const newCols = [...r.columns];
        newCols[colIndex] = { ...newCols[colIndex], [field]: value };
        return { ...r, columns: newCols };
      }
      return r;
    });
    setDesignData({ ...designData, rows: newRows });
  };

  const removeColumn = (rowId: string, colIndex: number) => {
    const newRows = designData.rows.map(r => {
      if (r.id === rowId) {
        const newCols = [...r.columns];
        newCols.splice(colIndex, 1);
        return { ...r, columns: newCols };
      }
      return r;
    });
    setDesignData({ ...designData, rows: newRows });
  };

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
    setActiveTab('manage'); setSuccessMsg(null); setError(null);
  };

  const handleCopyLink = async () => {
    if (generatedPassUrl) {
      await navigator.clipboard.writeText(generatedPassUrl);
      alert('Link copied to clipboard!');
    }
  };

  const handleGenerateApiKey = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/developer-settings', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setDevSettings({ apiKey: data.apiKey });
        setSuccessMsg('New API Key generated successfully.');
      } else {
        throw new Error(data.error || 'Failed to generate key');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fadeUp = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, type: 'spring' as const, bounce: 0, damping: 20 } }
  };

  return (
    <AnimatePresence mode="wait">
      <motion.main key="dashboard" initial="hidden" animate="visible" exit="exit" variants={fadeUp} className="flex-1 max-w-6xl w-full mx-auto px-6 py-8">
        <div className="mb-8 flex justify-between items-center">
          <div />
          <Link href="/scan" className={clsx(buttonBaseClass, buttonVariants.secondary, "py-2")}>
            <QrCode className="w-4 h-4" /> Scanner App
          </Link>
        </div>
        
        <div className="mb-10">
          <h1 className="text-3xl font-semibold text-ink-dark tracking-tight mb-6">
            Dashboard
          </h1>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card className="p-4 bg-surface-card border-border-subtle flex flex-col justify-center">
              <p className="text-sm font-medium text-ink-secondary">Total Members</p>
              <h3 className="text-2xl font-semibold text-ink-dark mt-1">{stats.memberCount}</h3>
            </Card>
            <Card className="p-4 bg-surface-card border-border-subtle flex flex-col justify-center">
              <p className="text-sm font-medium text-ink-secondary">Passes Issued</p>
              <h3 className="text-2xl font-semibold text-ink-dark mt-1">{stats.passCount}</h3>
            </Card>
            <Card className="p-4 bg-surface-card border-border-subtle flex flex-col justify-center">
              <p className="text-sm font-medium text-ink-secondary">System Status</p>
              <div className="flex items-center gap-2 mt-1">
                <div className={`w-2 h-2 rounded-full ${stats.walletStatus.includes('Active') ? 'bg-emerald-500' : 'bg-brand-orange animate-pulse'}`} />
                <h3 className="text-sm font-medium text-ink-dark">{stats.walletStatus}</h3>
              </div>
            </Card>
          </div>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mt-6">
            <div className="flex flex-wrap sm:flex-nowrap gap-2 bg-surface-card p-1.5 rounded-xl border border-border-subtle w-full sm:w-fit">
              <button onClick={() => setActiveTab('design')} className={`flex-1 sm:flex-none justify-center px-4 py-2 rounded-lg font-medium text-sm transition-all flex items-center gap-2 ${activeTab === 'design' ? 'bg-surface-bone text-ink-dark shadow-sm' : 'text-ink-secondary hover:text-ink-dark'}`}>
                <Palette className="w-4 h-4"/> Template
              </button>

              <button onClick={() => setActiveTab('manage')} className={`flex-1 sm:flex-none justify-center px-4 py-2 rounded-lg font-medium text-sm transition-all flex items-center gap-2 ${activeTab === 'manage' ? 'bg-surface-bone text-ink-dark shadow-sm' : 'text-ink-secondary hover:text-ink-dark'}`}>
                <RefreshCw className="w-4 h-4"/> Live Updates
              </button>
              <button onClick={() => setActiveTab('developer' as any)} className={`flex-1 sm:flex-none justify-center px-4 py-2 rounded-lg font-medium text-sm transition-all flex items-center gap-2 ${(activeTab as any) === 'developer' ? 'bg-surface-bone text-ink-dark shadow-sm' : 'text-ink-secondary hover:text-ink-dark'}`}>
                <Zap className="w-4 h-4"/> Developer Settings
              </button>
            </div>
            <div className="flex flex-col items-start sm:items-end gap-1.5 w-full sm:w-auto">
               <label className="text-xs font-medium text-ink-secondary">Select Tenant</label>
               <select value={selectedTenantId} onChange={(e) => handleTenantChange(e.target.value)} className="w-full sm:w-auto bg-surface-card border border-border-subtle rounded-lg px-3 py-1.5 text-sm text-ink-dark focus:outline-none focus:border-brand-orange">
                  {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
               </select>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-7 space-y-6">
            <Card className="p-6 sm:p-8">
              
              {/* DESIGN TAB */}
              {activeTab === 'design' && (
                <motion.div key="tab-design" initial={{opacity:0}} animate={{opacity:1}} className="space-y-6">
                  <div className="border-b border-white/5 pb-4 mb-4">
                    <h2 className="text-xl font-medium text-ink-dark tracking-tight">Template Designer</h2>
                    <p className="text-sm text-ink-secondary mt-1">Design your Class template mirroring the Google Wallet console structure.</p>
                  </div>

                  {origin && (
                    <div className="bg-surface-card border border-brand-orange/30 p-4 rounded-xl flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <Label className="text-brand-orange mb-1">Consumer Enrollment Link</Label>
                        <div className="flex items-center gap-2 mt-1 min-w-0">
                          <code className="text-xs bg-surface-bone px-2 py-1 rounded text-ink-dark truncate flex-1">
                            {`${origin}/enroll/${designData.classSuffix}`}
                          </code>
                          <Button 
                            type="button" 
                            variant="secondary" 
                            className="shrink-0 h-7 text-xs px-3"
                            onClick={() => {
                              navigator.clipboard.writeText(`${origin}/enroll/${designData.classSuffix}`);
                              alert('Enrollment link copied to clipboard!');
                            }}
                          >
                            Copy Link
                          </Button>
                        </div>
                      </div>
                      <div className="p-2 bg-white rounded-lg shrink-0">
                        <QRCodeSVG value={`${origin}/enroll/${designData.classSuffix}`} size={64} level="L" includeMargin={false} />
                      </div>
                    </div>
                  )}
                  
                  <div>
                    <Label>Class Suffix</Label>
                    <Input type="text" value={designData.classSuffix} onChange={(e) => setDesignData({...designData, classSuffix: e.target.value})} className="font-mono" required/>
                  </div>

                  <div className="space-y-1">
                    <Label>Pass Archetype</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {ARCHETYPES.map((arch) => (
                        <button key={arch.value} type="button"
                          onClick={() => setDesignData(prev => ({ ...prev, archetype: arch.value }))}
                          className={`py-2 px-3 rounded-lg text-sm font-medium border transition-all ${
                            designData.archetype === arch.value
                              ? 'bg-brand-orange/10 border-brand-orange text-brand-orange'
                              : 'bg-surface-bone border-border-subtle text-ink-secondary hover:border-border-strong'
                          }`}>
                          {arch.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <Label>Program / Brand Title</Label>
                    <Input type="text" value={designData.cardTitle} onChange={(e) => setDesignData({...designData, cardTitle: e.target.value})} required/>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div className="space-y-2">
                      <Label>Logo Image URL</Label>
                      <Input type="text" value={designData.logoUrl} onChange={(e) => setDesignData({...designData, logoUrl: e.target.value})} placeholder="https://.../logo.png"/>
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onloadend = () => setDesignData({...designData, logoUrl: reader.result as string});
                            reader.readAsDataURL(file);
                          }
                        }} 
                        className="w-full text-xs text-ink-secondary file:mr-4 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-brand-orange/10 file:text-brand-orange hover:file:bg-brand-orange/20 cursor-pointer"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Hero Image URL</Label>
                      <Input type="text" value={designData.heroImageUrl} onChange={(e) => setDesignData({...designData, heroImageUrl: e.target.value})} placeholder="https://.../hero.png"/>
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onloadend = () => setDesignData({...designData, heroImageUrl: reader.result as string});
                            reader.readAsDataURL(file);
                          }
                        }} 
                        className="w-full text-xs text-ink-secondary file:mr-4 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-brand-orange/10 file:text-brand-orange hover:file:bg-brand-orange/20 cursor-pointer"
                      />
                    </div>
                  </div>

                  <div className="bg-surface-card p-5 rounded-xl border border-border-subtle space-y-4">
                    <div className="flex items-center justify-between">
                       <Label>Dynamic Rows</Label>
                       <button type="button" onClick={addRow} disabled={designData.rows.length >= 3} className="text-xs font-medium text-brand-orange hover:text-brand-orange-hover transition-colors flex items-center gap-1 disabled:opacity-50">
                         <Plus className="w-3 h-3" /> Add Row
                       </button>
                    </div>
                    
                    {designData.rows.map((row, rIdx) => (
                      <div key={row.id} className="p-3 bg-canvas rounded-lg border border-border-subtle relative">
                        <div className="flex items-center justify-between mb-3">
                           <span className="text-[10px] font-medium text-ink-muted">Row {rIdx + 1}</span>
                           <button type="button" onClick={() => removeRow(row.id)} className="text-ink-muted hover:text-red-500 transition-colors"><X className="w-3 h-3"/></button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {row.columns.map((col, cIdx) => (
                            <div key={cIdx} className="flex-1 min-w-30 space-y-1.5 border-l border-border-subtle pl-3">
                              <div className="flex justify-between items-center">
                                 <input type="text" value={col.header} onChange={(e) => updateColumn(row.id, cIdx, 'header', e.target.value)} placeholder="Header" className="text-xs font-medium w-full bg-transparent border-none focus:ring-0 p-0 text-ink-dark placeholder:text-ink-muted outline-none" />
                                 {row.columns.length > 1 && (
                                   <button type="button" onClick={() => removeColumn(row.id, cIdx)} className="text-ink-muted hover:text-red-500 ml-1"><X className="w-3 h-3"/></button>
                                 )}
                              </div>
                              <input type="text" value={col.body} onChange={(e) => updateColumn(row.id, cIdx, 'body', e.target.value)} placeholder="Body" className="text-sm w-full bg-transparent border-none focus:ring-0 p-0 text-ink-secondary placeholder:text-ink-muted outline-none" />
                            </div>
                          ))}
                          {row.columns.length < 3 && (
                            <button type="button" onClick={() => addColumn(row.id)} className="flex items-center justify-center w-8 h-8 rounded-md border border-dashed border-border-strong text-ink-muted hover:text-brand-orange hover:border-brand-orange transition-colors shrink-0">
                              <Plus className="w-4 h-4"/>
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div>
                    <Label>Background Theme</Label>
                    <div className="flex flex-wrap items-center gap-3 mt-2">
                      {COLOR_PALETTE.map((c) => (
                        <button 
                          key={c.hex} type="button" title={c.name}
                          onClick={() => setDesignData({...designData, hexBackgroundColor: c.hex})} 
                          className={`w-8 h-8 rounded-full border-2 transition-all ${designData.hexBackgroundColor === c.hex ? 'border-white scale-110 shadow-[0_0_10px_rgba(255,255,255,0.3)]' : 'border-transparent opacity-60 hover:scale-105'}`} 
                          style={{backgroundColor: c.hex}}
                        />
                      ))}
                    </div>
                  </div>

                  {templateStatus !== 'unsaved' && (
                    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border ${
                      templateStatus === 'published'
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${templateStatus === 'published' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                      {templateStatus === 'published' ? 'Published to Wallet' : 'Draft saved'}
                    </div>
                  )}

                  <div className="flex gap-2 pt-2">
                    <Button type="button" variant="secondary" className="flex-1" onClick={async () => {
                      try {
                        if (savedTemplateId) {
                          const res = await fetch(`/api/templates/${savedTemplateId}`, {
                            method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ name: designData.cardTitle, archetype: designData.archetype, fieldRows: designData.rows, hexBackgroundColor: designData.hexBackgroundColor, logoUrl: designData.logoUrl || null, heroImageUrl: designData.heroImageUrl || null }),
                          });
                          const data = await res.json();
                          if (data.success) { alert('Draft updated'); setTemplateStatus('draft'); }
                        } else {
                          const res = await fetch('/api/templates', {
                            method: 'POST', headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ tenantId: currentTenant?.id || selectedTenantId, classSuffix: designData.classSuffix, name: designData.cardTitle, archetype: designData.archetype, fieldRows: designData.rows, hexBackgroundColor: designData.hexBackgroundColor, logoUrl: designData.logoUrl || null, heroImageUrl: designData.heroImageUrl || null }),
                          });
                          const data = await res.json();
                          if (data.success) { setSavedTemplateId(data.template.id); setTemplateStatus('draft'); alert('Draft saved'); }
                        }
                      } catch (e) { console.error(e); alert('Error saving draft'); }
                    }}>
                      Save as Draft
                    </Button>
                    <Button type="button" className="flex-1" disabled={templateStatus === 'published'} onClick={async () => {
                      let tplId = savedTemplateId;
                      if (!tplId) {
                        try {
                          const res = await fetch('/api/templates', {
                            method: 'POST', headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ tenantId: currentTenant?.id || selectedTenantId, name: designData.cardTitle || 'New Template', archetype: designData.archetype, classSuffix: designData.classSuffix, fieldRows: designData.rows, hexBackgroundColor: designData.hexBackgroundColor, logoUrl: designData.logoUrl || null, heroImageUrl: designData.heroImageUrl || null }),
                          });
                          const data = await res.json();
                          if (!data.success) throw new Error(data.error || 'Failed to create template');
                          tplId = data.template.id;
                          setSavedTemplateId(tplId);
                        } catch (err: any) { alert(`Failed: ${err.message}`); return; }
                      }
                      try {
                        const res = await fetch(`/api/templates/${tplId}/publish`, { method: 'POST' });
                        const data = await res.json();
                        if (!data.success) throw new Error(data.error || 'Failed to publish');
                        setTemplateStatus('published');
                        alert('Published to Google Wallet API');
                      } catch (e: any) { console.error(e); alert(`Publish failed: ${e.message}`); }
                    }}>
                      Publish to Wallet
                    </Button>
                  </div>
                </motion.div>
              )}



              {/* MANAGE TAB */}
              {activeTab === 'manage' && (
                <motion.form key="tab-manage" initial={{opacity:0}} animate={{opacity:1}} onSubmit={handleUpdatePass} className="space-y-6">
                  <div className="border-b border-white/5 pb-4 mb-4">
                    <h2 className="text-xl font-medium text-ink-dark tracking-tight">Live Update</h2>
                    <p className="text-sm text-ink-secondary mt-1">Select a pass from history to instantly patch its data.</p>
                  </div>
                  <div>
                    <Label>Object Pass ID</Label>
                    <Input type="text" value={manageData.passId} onChange={(e) => setManageData({...manageData, passId: e.target.value})} placeholder="Select a pass from history" className="font-mono" required readOnly/>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                     <div>
                      <Label>Update Tier</Label>
                      <Input type="text" value={manageData.tier} onChange={(e) => setManageData({...manageData, tier: e.target.value})} required disabled={!manageData.passId}/>
                    </div>
                    <div>
                      <Label>Update Balance</Label>
                      <Input type="text" value={manageData.balance} onChange={(e) => setManageData({...manageData, balance: e.target.value})} required disabled={!manageData.passId}/>
                    </div>
                  </div>
                  
                  <div>
                    <Label>Push Notification Message (Optional)</Label>
                    <Input 
                      type="text" 
                      value={manageData.pushNotification} 
                      onChange={(e) => setManageData({...manageData, pushNotification: e.target.value})} 
                      placeholder="e.g. Your new balance is 150 Pts." 
                      disabled={!manageData.passId}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div>
                      <Label>Customer Phone (WA Receipt)</Label>
                      <Input type="text" value={manageData.phone} onChange={(e) => setManageData({...manageData, phone: e.target.value})} placeholder="+91..." disabled={!manageData.passId}/>
                    </div>
                    <div>
                      <Label>Brand Name</Label>
                      <Input type="text" value={manageData.brandName} onChange={(e) => setManageData({...manageData, brandName: e.target.value})} placeholder="LinearCard" disabled={!manageData.passId}/>
                    </div>
                  </div>

                  <Button type="submit" disabled={loading || !manageData.passId} className="w-full">
                    {loading ? 'Patching via API...' : 'Push Live Update'}
                  </Button>
                </motion.form>
              )}

              {/* DEVELOPER SETTINGS TAB */}
              {(activeTab as any) === 'developer' && (
                <motion.div key="tab-developer" initial={{opacity:0}} animate={{opacity:1}} className="space-y-6">
                  <div className="border-b border-white/5 pb-4 mb-4">
                    <h2 className="text-xl font-medium text-ink-dark tracking-tight">Developer Settings</h2>
                    <p className="text-sm text-ink-secondary mt-1">Manage API keys for programmatic programmatic access.</p>
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <Label>Tenant API Key (Bearer Token)</Label>
                      <div className="flex items-center gap-3">
                        <Input type="text" value={devSettings.apiKey} readOnly className="font-mono" />
                        <Button variant="secondary" onClick={handleGenerateApiKey} disabled={loading} className="shrink-0">
                           Regenerate
                        </Button>
                      </div>
                      <p className="text-xs text-ink-muted mt-2">Use this key in the Authorization header to call /api/update-pass.</p>
                    </div>
                  </div>
                </motion.div>
              )}

              {error && <motion.div initial={{opacity:0}} animate={{opacity:1}} className="mt-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm flex items-start gap-3"><AlertCircle className="w-4 h-4 shrink-0 mt-0.5"/> <p>{error}</p></motion.div>}
              {successMsg && <motion.div initial={{opacity:0}} animate={{opacity:1}} className="mt-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm flex items-start gap-3"><CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5"/> <p>{successMsg}</p></motion.div>}
            </Card>
          </div>

          <div className="lg:col-span-5 space-y-6">
            <Card className="p-6 flex flex-col items-center bg-surface-card border-none">
               <div className="w-full flex items-center justify-between mb-6">
                <span className="text-sm font-medium text-ink-secondary">Live Preview</span>
              </div>
              <div className="w-full py-2 flex justify-center">
                <motion.div whileHover={{ scale: 1.02, rotateY: -2, rotateX: 2 }} transition={{ type: "spring", stiffness: 200, damping: 20 }} className="w-full sm:max-w-112.5">
                  <PassPreviewCard
                    memberName={activeTab === 'manage' && manageData.passId ? 'Live Pass' : 'Dhyan Patel'}
                    cardTitle={designData.cardTitle}
                    hexBackgroundColor={designData.hexBackgroundColor}
                    barcodeAltText={'882190'}
                    barcodeValue={'https://linearcard.vercel.app/member/882190'}
                    logoUrl={designData.logoUrl}
                    heroImageUrl={designData.heroImageUrl}
                    rows={designData.rows}
                    manageTier={manageData.tier}
                    manageBalance={manageData.balance}
                    isManageTab={activeTab === 'manage' && !!manageData.passId}
                  />
                </motion.div>
              </div>
            </Card>

            <Card className="p-5">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-medium text-ink-secondary">Session Passes</span>
                <span className="text-[10px] text-ink-muted bg-surface-card px-2 py-1 rounded">Click to Manage</span>
              </div>
              
              {passHistory.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-28 text-ink-muted text-sm border border-dashed border-border-subtle rounded-xl bg-surface-card/50">
                  No passes generated yet.
                </div>
              ) : (
                <div className="space-y-1.5">
                  {passHistory.map((item, idx) => (
                    <div
                      key={idx}
                      onClick={() => selectPassForManage(item)}
                      className={`p-3 rounded-lg border flex items-center justify-between cursor-pointer transition-colors group ${
                        manageData.passId === (item.fullPassId || item.passId)
                          ? 'bg-brand-orange/10 border-brand-orange/30'
                          : 'bg-surface-card border-border-subtle hover:border-border-strong'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{backgroundColor: item.passData?.hexBackgroundColor || '#1A365D'}}/>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-ink-dark truncate">
                            {item.passData?.memberName}
                          </p>
                          <p className="text-[10px] text-ink-muted font-mono truncate">
                            {item.fullPassId || item.passId}
                          </p>
                        </div>
                      </div>
                      <ArrowRight className={`w-3.5 h-3.5 transition-all ${manageData.passId === (item.fullPassId || item.passId) ? 'text-brand-orange' : 'text-ink-muted group-hover:text-ink-secondary'}`} />
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </div>
      </motion.main>
    </AnimatePresence>
  );
}
