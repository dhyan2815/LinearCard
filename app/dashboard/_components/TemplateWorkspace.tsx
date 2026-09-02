'use client';
import React from 'react';
import { Card } from '@/components/ui/Card';
import { Label } from '@/components/ui/Label';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Plus, X } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

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

export function TemplateWorkspace({
  designData,
  setDesignData,
  origin,
  templateStatus,
  savedTemplateId,
  setSavedTemplateId,
  setTemplateStatus,
  currentTenant,
  selectedTenantId
}: any) {
  const addRow = () => {
    if (designData.rows.length >= 3) return;
    setDesignData({
      ...designData, 
      rows: [...designData.rows, { id: `row${Date.now()}`, columns: [{ header: 'New Field', body: 'Value' }] }]
    });
  };

  const removeRow = (rowId: string) => {
    setDesignData({ ...designData, rows: designData.rows.filter((r: any) => r.id !== rowId) });
  };

  const addColumn = (rowId: string) => {
    const newRows = designData.rows.map((r: any) => {
      if (r.id === rowId && r.columns.length < 3) {
        return { ...r, columns: [...r.columns, { header: 'New Field', body: 'Value' }] };
      }
      return r;
    });
    setDesignData({ ...designData, rows: newRows });
  };

  const updateColumn = (rowId: string, colIndex: number, field: 'header' | 'body', value: string) => {
    const newRows = designData.rows.map((r: any) => {
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
    const newRows = designData.rows.map((r: any) => {
      if (r.id === rowId) {
        const newCols = [...r.columns];
        newCols.splice(colIndex, 1);
        return { ...r, columns: newCols };
      }
      return r;
    });
    setDesignData({ ...designData, rows: newRows });
  };

  const handleSaveDraft = async () => {
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
  };

  const handlePublish = async () => {
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
    } else {
      try {
        const res = await fetch(`/api/templates/${tplId}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: designData.cardTitle, archetype: designData.archetype, fieldRows: designData.rows, hexBackgroundColor: designData.hexBackgroundColor, logoUrl: designData.logoUrl || null, heroImageUrl: designData.heroImageUrl || null }),
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error || 'Failed to sync edits before publish');
        setTemplateStatus('draft');
      } catch (err: any) { alert(`Sync failed: ${err.message}`); return; }
    }
    try {
      const res = await fetch(`/api/templates/${tplId}/publish`, { method: 'POST' });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to publish');
      setTemplateStatus('published');
      alert('Published to Google Wallet API');
    } catch (e: any) { console.error(e); alert(`Publish failed: ${e.message}`); }
  };

  return (
    <div className="flex flex-col gap-8 w-full max-w-2xl">
      <div className="border-b border-border-subtle pb-4">
        <h2 className="text-xl font-medium text-ink-dark tracking-tight">Template Builder</h2>
        <p className="text-sm text-ink-secondary mt-1">Design the core structure of your Google Wallet Class.</p>
      </div>

      {origin && (
        <div className="bg-surface-card border border-brand-blue/30 p-5 rounded-xl flex items-center justify-between gap-4 shadow-sm">
          <div className="flex-1 min-w-0">
            <Label className="text-xs font-semibold uppercase tracking-wider text-brand-blue mb-1">Consumer Enrollment Link</Label>
            <div className="flex items-center gap-2 mt-1 min-w-0">
              <code className="text-sm bg-canvas px-3 py-2 rounded-lg border border-border-subtle text-ink-dark truncate flex-1">
                {`${origin}/enroll/${designData.classSuffix}`}
              </code>
              <Button 
                type="button" 
                variant="secondary" 
                className="shrink-0 h-9"
                onClick={() => {
                  navigator.clipboard.writeText(`${origin}/enroll/${designData.classSuffix}`);
                  alert('Enrollment link copied to clipboard!');
                }}
              >
                Copy Link
              </Button>
            </div>
          </div>
          <div className="p-2 bg-white rounded-lg shrink-0 shadow-sm">
            <QRCodeSVG value={`${origin}/enroll/${designData.classSuffix}`} size={64} level="L" includeMargin={false} />
          </div>
        </div>
      )}

      <div className="space-y-6">
        <div>
          <Label className="text-xs font-semibold text-ink-dark uppercase tracking-wide">Program Title</Label>
          <Input type="text" value={designData.cardTitle} onChange={(e) => setDesignData({...designData, cardTitle: e.target.value})} className="mt-2" required/>
        </div>

        <div>
          <Label className="text-xs font-semibold text-ink-dark uppercase tracking-wide">Class Suffix (URL ID)</Label>
          <Input type="text" value={designData.classSuffix} onChange={(e) => setDesignData({...designData, classSuffix: e.target.value})} className="mt-2 font-mono" required/>
        </div>

        <div className="space-y-2">
          <Label className="text-xs font-semibold text-ink-dark uppercase tracking-wide">Pass Archetype</Label>
          <div className="grid grid-cols-2 gap-2 mt-2">
            {ARCHETYPES.map((arch) => (
              <button key={arch.value} type="button"
                onClick={() => setDesignData((prev: any) => ({ ...prev, archetype: arch.value }))}
                className={`py-2.5 px-3 rounded-lg text-sm font-medium border transition-all ${
                  designData.archetype === arch.value
                    ? 'bg-brand-blue/10 border-brand-blue text-brand-blue'
                    : 'bg-surface-card border-border-subtle text-ink-secondary hover:border-border-strong'
                }`}>
                {arch.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-ink-dark uppercase tracking-wide">Logo Asset URL</Label>
            <Input type="text" value={designData.logoUrl} onChange={(e) => setDesignData({...designData, logoUrl: e.target.value})} placeholder="https://..." className="mt-1 font-mono text-sm"/>
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-ink-dark uppercase tracking-wide">Hero Cover URL</Label>
            <Input type="text" value={designData.heroImageUrl} onChange={(e) => setDesignData({...designData, heroImageUrl: e.target.value})} placeholder="https://..." className="mt-1 font-mono text-sm"/>
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-xs font-semibold text-ink-dark uppercase tracking-wide">Brand Palette</Label>
          <div className="flex flex-wrap items-center gap-4 mt-2">
            {COLOR_PALETTE.map((c) => (
              <button 
                key={c.hex} type="button" title={c.name}
                onClick={() => setDesignData({...designData, hexBackgroundColor: c.hex})} 
                className={`w-8 h-8 rounded-full border-2 transition-all ${designData.hexBackgroundColor === c.hex ? 'border-white dark:border-zinc-300 scale-110 shadow-sm' : 'border-transparent opacity-60 hover:scale-105 hover:opacity-100'}`} 
                style={{backgroundColor: c.hex}}
              />
            ))}
          </div>
        </div>

        <div className="bg-surface-card p-6 rounded-xl border border-border-subtle shadow-sm space-y-5">
          <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-ink-dark uppercase tracking-wide">Dynamic Fields Architecture</Label>
              <button type="button" onClick={addRow} disabled={designData.rows.length >= 3} className="text-xs font-semibold text-brand-blue hover:text-brand-blue-hover transition-colors flex items-center gap-1 disabled:opacity-50">
                <Plus className="w-4 h-4" /> Add Row
              </button>
          </div>
          
          {designData.rows.map((row: any, rIdx: number) => (
            <div key={row.id} className="p-4 bg-canvas rounded-lg border border-border-subtle relative group">
              <div className="flex items-center justify-between mb-4">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">Row {rIdx + 1}</span>
                  <button type="button" onClick={() => removeRow(row.id)} className="text-ink-muted hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"><X className="w-4 h-4"/></button>
              </div>
              <div className="flex flex-wrap gap-3">
                {row.columns.map((col: any, cIdx: number) => (
                  <div key={cIdx} className="flex-1 min-w-30 space-y-2.5 border-l-2 border-border-subtle pl-4">
                    <div className="flex justify-between items-center">
                        <input type="text" value={col.header} onChange={(e) => updateColumn(row.id, cIdx, 'header', e.target.value)} placeholder="Header" className="text-xs font-semibold w-full bg-transparent border-none focus:ring-0 p-0 text-ink-dark placeholder:text-ink-muted outline-none" />
                        {row.columns.length > 1 && (
                          <button type="button" onClick={() => removeColumn(row.id, cIdx)} className="text-ink-muted hover:text-red-500 ml-1"><X className="w-3.5 h-3.5"/></button>
                        )}
                    </div>
                    <input type="text" value={col.body} onChange={(e) => updateColumn(row.id, cIdx, 'body', e.target.value)} placeholder="Body" className="text-sm w-full bg-transparent border-none focus:ring-0 p-0 text-ink-secondary placeholder:text-ink-muted outline-none" />
                  </div>
                ))}
                {row.columns.length < 3 && (
                  <button type="button" onClick={() => addColumn(row.id)} className="flex items-center justify-center w-10 h-10 rounded-md border border-dashed border-border-strong text-ink-muted hover:text-brand-blue hover:border-brand-blue/50 transition-colors shrink-0">
                    <Plus className="w-4 h-4"/>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between pt-6 border-t border-border-subtle gap-4">
          <div>
            {templateStatus !== 'unsaved' && (
              <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold tracking-wide uppercase border ${
                templateStatus === 'published'
                  ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                  : 'bg-amber-500/10 text-amber-500 border-amber-500/20'
              }`}>
                <span className={`w-2 h-2 rounded-full ${templateStatus === 'published' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                {templateStatus === 'published' ? 'Published Live' : 'Draft Saved'}
              </div>
            )}
          </div>
          <div className="flex gap-3">
            <Button type="button" variant="secondary" onClick={handleSaveDraft} className="flex-1 sm:flex-none">
              Save Draft
            </Button>
            <Button type="button" disabled={templateStatus === 'published'} onClick={handlePublish} className="flex-1 sm:flex-none">
              Publish Template
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
