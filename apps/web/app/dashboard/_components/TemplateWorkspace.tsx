'use client';
import React from 'react';
import { Card } from '@/components/ui/Card';
import { Label } from '@/components/ui/Label';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Plus, X, Link as LinkIcon, FileText, Image as ImageIcon } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

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

const ARCHETYPE_PRESETS: Record<string, any[]> = {
  loyalty: [
    { id: 'row1', columns: [{ header: 'Points', body: '500' }, { header: 'Tier', body: 'Gold' }] }
  ],
  membership: [
    { id: 'row1', columns: [{ header: 'Member ID', body: '100492' }, { header: 'Status', body: 'Active' }] },
    { id: 'row2', columns: [{ header: 'Home Club', body: 'YMCA' }, { header: 'Expires', body: '12/2026' }] }
  ],
  id_card: [
    { id: 'row1', columns: [{ header: 'Employee ID', body: 'EMP-992' }, { header: 'Role', body: 'Developer' }] },
    { id: 'row2', columns: [{ header: 'Department', body: 'Engineering' }, { header: 'Valid Thru', body: '12/2026' }] }
  ],
  access_badge: [
    { id: 'row1', columns: [{ header: 'Event', body: 'VIP Access' }, { header: 'Date', body: 'Oct 31' }] },
    { id: 'row2', columns: [{ header: 'Gate', body: 'A1' }, { header: 'Section', body: '10' }, { header: 'Seat', body: '5F' }] }
  ]
};

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

  // Links Module
  const addLink = () => {
    const current = designData.linksModuleData || [];
    if (current.length >= 10) return;
    setDesignData({
      ...designData,
      linksModuleData: [...current, { id: `link_${Date.now()}`, uri: '', description: '' }]
    });
    setTemplateStatus('draft');
  };

  const updateLink = (index: number, field: 'uri' | 'description', value: string) => {
    const current = [...(designData.linksModuleData || [])];
    if (current[index]) {
      current[index] = { ...current[index], [field]: value };
      setDesignData({ ...designData, linksModuleData: current });
      setTemplateStatus('draft');
    }
  };

  const removeLink = (index: number) => {
    const current = [...(designData.linksModuleData || [])];
    current.splice(index, 1);
    setDesignData({ ...designData, linksModuleData: current });
    setTemplateStatus('draft');
  };

  // Text Module (Info Blocks)
  const addTextBlock = () => {
    const current = designData.textModulesData || [];
    if (current.length >= 10) return;
    setDesignData({
      ...designData,
      textModulesData: [...current, { id: `text_${Date.now()}`, header: '', body: '' }]
    });
    setTemplateStatus('draft');
  };

  const updateTextBlock = (index: number, field: 'header' | 'body', value: string) => {
    const current = [...(designData.textModulesData || [])];
    if (current[index]) {
      current[index] = { ...current[index], [field]: value };
      setDesignData({ ...designData, textModulesData: current });
      setTemplateStatus('draft');
    }
  };

  const removeTextBlock = (index: number) => {
    const current = [...(designData.textModulesData || [])];
    current.splice(index, 1);
    setDesignData({ ...designData, textModulesData: current });
    setTemplateStatus('draft');
  };

  // Image Module (Promotional Banners)
  const addImageBlock = () => {
    const current = designData.imageModulesData || [];
    if (current.length >= 5) return;
    setDesignData({
      ...designData,
      imageModulesData: [...current, { id: `img_${Date.now()}`, imageUrl: '', description: '' }]
    });
    setTemplateStatus('draft');
  };

  const updateImageBlock = (index: number, field: 'imageUrl' | 'description', value: string) => {
    const current = [...(designData.imageModulesData || [])];
    if (current[index]) {
      current[index] = { ...current[index], [field]: value };
      setDesignData({ ...designData, imageModulesData: current });
      setTemplateStatus('draft');
    }
  };

  const removeImageBlock = (index: number) => {
    const current = [...(designData.imageModulesData || [])];
    current.splice(index, 1);
    setDesignData({ ...designData, imageModulesData: current });
    setTemplateStatus('draft');
  };

  const handleSaveDraft = async () => {
    const savePromise = async () => {
      if (savedTemplateId) {
        const data = await apiClient(`/templates/${savedTemplateId}`, {
          method: 'PATCH',
          body: JSON.stringify({
            name: designData.cardTitle,
            archetype: designData.archetype,
            fieldRows: designData.rows,
            hexBackgroundColor: designData.hexBackgroundColor,
            logoUrl: designData.logoUrl || null,
            heroImageUrl: designData.heroImageUrl || null,
            linksModuleData: designData.linksModuleData || [],
            imageModulesData: designData.imageModulesData || [],
            textModulesData: designData.textModulesData || [],
          }),
        });
        if (!data.success) throw new Error(data.error || 'Error saving draft');
        setTemplateStatus('draft');
      } else {
        const data = await apiClient('/templates', {
          method: 'POST',
          body: JSON.stringify({
            tenantId: currentTenant?.id || selectedTenantId,
            classSuffix: designData.classSuffix,
            name: designData.cardTitle,
            archetype: designData.archetype,
            fieldRows: designData.rows,
            hexBackgroundColor: designData.hexBackgroundColor,
            logoUrl: designData.logoUrl || null,
            heroImageUrl: designData.heroImageUrl || null,
            linksModuleData: designData.linksModuleData || [],
            imageModulesData: designData.imageModulesData || [],
            textModulesData: designData.textModulesData || [],
          }),
        });
        if (!data.success) throw new Error(data.error || 'Error saving draft');
        setSavedTemplateId(data.template.id);
        setTemplateStatus('draft');
      }
    };

    toast.promise(savePromise(), {
      loading: 'Saving draft...',
      success: 'Draft saved successfully!',
      error: (err: any) => err.message || 'Error saving draft'
    });
  };

  const handlePublish = async () => {

    const publishPromise = async () => {
      let tplId = savedTemplateId;
      if (!tplId) {
        const data = await apiClient('/templates', {
          method: 'POST',
          body: JSON.stringify({
            tenantId: currentTenant?.id || selectedTenantId,
            name: designData.cardTitle || 'New Template',
            archetype: designData.archetype,
            classSuffix: designData.classSuffix,
            fieldRows: designData.rows,
            hexBackgroundColor: designData.hexBackgroundColor,
            logoUrl: designData.logoUrl || null,
            heroImageUrl: designData.heroImageUrl || null,
            linksModuleData: designData.linksModuleData || [],
            imageModulesData: designData.imageModulesData || [],
            textModulesData: designData.textModulesData || [],
          }),
        });
        if (!data.success) throw new Error(data.error || 'Failed to create template');
        tplId = data.template.id;
        setSavedTemplateId(tplId);
      } else {
        const data = await apiClient(`/templates/${tplId}`, {
          method: 'PATCH',
          body: JSON.stringify({
            name: designData.cardTitle,
            archetype: designData.archetype,
            fieldRows: designData.rows,
            hexBackgroundColor: designData.hexBackgroundColor,
            logoUrl: designData.logoUrl || null,
            heroImageUrl: designData.heroImageUrl || null,
            linksModuleData: designData.linksModuleData || [],
            imageModulesData: designData.imageModulesData || [],
            textModulesData: designData.textModulesData || [],
          }),
        });
        if (!data.success) throw new Error(data.error || 'Failed to sync edits before publish');
        setTemplateStatus('draft');
      }
      
      const publishData = await apiClient(`/templates/${tplId}/publish`, { method: 'POST' });
      if (!publishData.success) throw new Error(publishData.error || 'Failed to publish');
      setTemplateStatus('published');
    };

    toast.promise(publishPromise(), {
      loading: 'Publishing to Google Wallet API...',
      success: 'Published to Google Wallet API successfully!',
      error: (err: any) => err.message || 'Publish failed'
    });
  };

  return (
    <div className="flex flex-col gap-8 w-full max-w-3xl">
      <div className="border-b border-border-subtle pb-4">
        <h2 className="text-xl font-medium text-ink-dark tracking-tight">Template Designer</h2>
        <p className="text-sm text-ink-secondary mt-1">Design the core structure of your Google Wallet!</p>
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
                  toast.success('Enrollment link copied to clipboard!');
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
          <Label className="text-xs font-semibold text-ink-dark uppercase tracking-wide flex items-center gap-2">
            Program Title
            {designData.classSuffix && (
              <span className="text-ink-muted normal-case tracking-normal font-normal">
                ({designData.classSuffix})
              </span>
            )}
          </Label>
          <Input type="text" value={designData.cardTitle} onChange={(e) => setDesignData({...designData, cardTitle: e.target.value})} className="mt-2" required/>
        </div>

        <div className="space-y-2">
          <Label className="text-xs font-semibold text-ink-dark uppercase tracking-wide">Pass Template Type</Label>
          <div className="grid grid-cols-2 gap-2 mt-2">
            {ARCHETYPES.map((arch) => (
              <button key={arch.value} type="button"
                onClick={() => {
                  setDesignData((prev: any) => {
                    if (prev.archetype === arch.value) return prev; // Do nothing if already active
                    return {
                      ...prev,
                      archetype: arch.value,
                      rows: ARCHETYPE_PRESETS[arch.value] || prev.rows
                    };
                  });
                  setTemplateStatus('draft');
                }}
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
            <div 
              className={`relative w-8 h-8 rounded-full border-2 overflow-hidden transition-all flex items-center justify-center bg-canvas shadow-sm ${!COLOR_PALETTE.find(c => c.hex === designData.hexBackgroundColor) ? 'border-white dark:border-zinc-300 scale-110 shadow-sm' : 'border-border-subtle opacity-60 hover:opacity-100 hover:scale-105 hover:border-border-strong'}`}
              title="Custom Color"
            >
              <input 
                type="color" 
                value={designData.hexBackgroundColor}
                onChange={(e) => setDesignData({...designData, hexBackgroundColor: e.target.value})}
                className="absolute -inset-2 w-12 h-12 cursor-pointer opacity-0 z-10"
              />
              <div 
                className="absolute inset-0 pointer-events-none" 
                style={{ backgroundColor: !COLOR_PALETTE.find(c => c.hex === designData.hexBackgroundColor) ? designData.hexBackgroundColor : 'transparent' }} 
              />
              {COLOR_PALETTE.find(c => c.hex === designData.hexBackgroundColor) && (
                <Plus className="w-4 h-4 text-ink-muted pointer-events-none z-0" />
              )}
            </div>
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

        {/* Advanced Pass Details Section */}
        <div className="space-y-5">
          <div className="border-b border-border-subtle pb-3">
            <h3 className="text-sm font-semibold text-ink-dark uppercase tracking-wide">
              Wallet Modules
            </h3>
            <p className="text-xs text-ink-muted mt-0.5">
              Configure interactive action links, custom info & policies, and promotional banners for the Google Wallet pass.
            </p>
          </div>

          {/* Quick Links and Actions (Links Module) */}
          <div className="bg-surface-card p-5 rounded-xl border border-border-subtle shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <LinkIcon className="w-4 h-4 text-brand-blue" />
                <Label className="text-xs font-semibold text-ink-dark uppercase tracking-wide">
                  Quick Links & Actions ({designData.linksModuleData?.length || 0}/10)
                </Label>
              </div>
              <button
                type="button"
                onClick={addLink}
                disabled={(designData.linksModuleData?.length || 0) >= 10}
                className="text-xs font-semibold text-brand-blue hover:text-brand-blue-hover transition-colors flex items-center gap-1 disabled:opacity-50"
              >
                <Plus className="w-3.5 h-3.5" /> Add Link
              </button>
            </div>

            {(!designData.linksModuleData || designData.linksModuleData.length === 0) ? (
              <div className="py-4 px-3 text-center border border-dashed border-border-subtle rounded-lg">
                <p className="text-xs text-ink-muted">No quick links added. Click &quot;Add Link&quot; to include website, booking, or support contact links.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {designData.linksModuleData.map((link: any, idx: number) => (
                  <div key={link.id || idx} className="p-3 bg-canvas rounded-lg border border-border-subtle flex flex-col sm:flex-row items-stretch sm:items-center gap-3 group">
                    <div className="w-full sm:w-1/3">
                      <Input
                        type="text"
                        value={link.description}
                        onChange={(e) => updateLink(idx, 'description', e.target.value)}
                        placeholder="Label (e.g. Website, Reserve Table)"
                        className="text-xs h-8"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <Input
                        type="text"
                        value={link.uri}
                        onChange={(e) => updateLink(idx, 'uri', e.target.value)}
                        placeholder="Destination (https://..., tel:..., mailto:...)"
                        className="text-xs font-mono h-8"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeLink(idx)}
                      className="text-ink-muted hover:text-red-500 p-1.5 self-end sm:self-center transition-colors"
                      title="Remove link"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Custom Info & Policies (Text Module) */}
          <div className="bg-surface-card p-5 rounded-xl border border-border-subtle shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-500" />
                <Label className="text-xs font-semibold text-ink-dark uppercase tracking-wide">
                  Custom Info & Policies ({designData.textModulesData?.length || 0}/10)
                </Label>
              </div>
              <button
                type="button"
                onClick={addTextBlock}
                disabled={(designData.textModulesData?.length || 0) >= 10}
                className="text-xs font-semibold text-brand-blue hover:text-brand-blue-hover transition-colors flex items-center gap-1 disabled:opacity-50"
              >
                <Plus className="w-3.5 h-3.5" /> Add Info Block
              </button>
            </div>

            {(!designData.textModulesData || designData.textModulesData.length === 0) ? (
              <div className="py-4 px-3 text-center border border-dashed border-border-subtle rounded-lg">
                <p className="text-xs text-ink-muted">No info blocks added. Click &quot;Add Info Block&quot; to include store hours, return policies, or Wi-Fi guidelines.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {designData.textModulesData.map((item: any, idx: number) => (
                  <div key={item.id || idx} className="p-3.5 bg-canvas rounded-lg border border-border-subtle space-y-2.5 relative group">
                    <div className="flex items-center justify-between gap-2">
                      <Input
                        type="text"
                        value={item.header}
                        onChange={(e) => updateTextBlock(idx, 'header', e.target.value)}
                        placeholder="Header (e.g. Operating Hours, Return Policy, Wi-Fi Access)"
                        className="text-xs font-medium h-8"
                      />
                      <button
                        type="button"
                        onClick={() => removeTextBlock(idx)}
                        className="text-ink-muted hover:text-red-500 p-1 transition-colors shrink-0"
                        title="Remove info block"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <textarea
                      value={item.body}
                      onChange={(e) => updateTextBlock(idx, 'body', e.target.value)}
                      placeholder="Details / Policy content..."
                      rows={2}
                      className="w-full text-xs p-2 rounded-md bg-surface-card border border-border-subtle text-ink-dark placeholder:text-ink-muted focus:outline-none focus:ring-1 focus:ring-brand-blue resize-none"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Promotional Banners (Image Module) */}
          <div className="bg-surface-card p-5 rounded-xl border border-border-subtle shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-purple-500" />
                <Label className="text-xs font-semibold text-ink-dark uppercase tracking-wide">
                  Promotional Banners ({designData.imageModulesData?.length || 0}/5)
                </Label>
              </div>
              <button
                type="button"
                onClick={addImageBlock}
                disabled={(designData.imageModulesData?.length || 0) >= 5}
                className="text-xs font-semibold text-brand-blue hover:text-brand-blue-hover transition-colors flex items-center gap-1 disabled:opacity-50"
              >
                <Plus className="w-3.5 h-3.5" /> Add Banner
              </button>
            </div>

            {(!designData.imageModulesData || designData.imageModulesData.length === 0) ? (
              <div className="py-4 px-3 text-center border border-dashed border-border-subtle rounded-lg">
                <p className="text-xs text-ink-muted">No promotional banners added. Click &quot;Add Banner&quot; to showcase seasonal campaigns or featured imagery.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {designData.imageModulesData.map((img: any, idx: number) => (
                  <div key={img.id || idx} className="p-3 bg-canvas rounded-lg border border-border-subtle flex flex-col sm:flex-row items-stretch sm:items-center gap-3 group">
                    <div className="flex-1 min-w-0">
                      <Input
                        type="text"
                        value={img.imageUrl}
                        onChange={(e) => updateImageBlock(idx, 'imageUrl', e.target.value)}
                        placeholder="Banner Image URL (https://...)"
                        className="text-xs font-mono h-8"
                      />
                    </div>
                    <div className="w-full sm:w-1/3">
                      <Input
                        type="text"
                        value={img.description}
                        onChange={(e) => updateImageBlock(idx, 'description', e.target.value)}
                        placeholder="Alt / Caption Description"
                        className="text-xs h-8"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeImageBlock(idx)}
                      className="text-ink-muted hover:text-red-500 p-1.5 self-end sm:self-center transition-colors"
                      title="Remove banner"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
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
