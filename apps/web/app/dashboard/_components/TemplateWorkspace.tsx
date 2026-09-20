'use client';
import React from 'react';
import { Card } from '@/components/ui/Card';
import { Label } from '@/components/ui/Label';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Plus, X, ChevronDown, Gift, IdCard, ShieldCheck, Ticket, ImageOff } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import { StoreLocationEntry } from './StoreLocationEntry';

const COLOR_PALETTE = [
  { name: 'Midnight Black', hex: '#0F172A' },
  { name: 'Ocean Blue', hex: '#0284C7' },
  { name: 'Emerald Green', hex: '#059669' },
  { name: 'Amethyst Purple', hex: '#7C3AED' },
  { name: 'Ruby Red', hex: '#DC2626' },
  { name: 'Sunset Orange', hex: '#EA580C' },
  { name: 'Amber Gold', hex: '#D97706' },
  { name: 'Rose Pink', hex: '#DB2777' },
  { name: 'Teal Breeze', hex: '#0D9488' },
  { name: 'Slate Gray', hex: '#475569' }
];

const ARCHETYPES = [
  { value: 'loyalty',      label: 'Loyalty', icon: Gift },
  { value: 'membership',   label: 'Membership', icon: ShieldCheck },
  { value: 'id_card',      label: 'ID Card', icon: IdCard },
  { value: 'access_badge', label: 'Access Badge', icon: Ticket },
] as const;

function generateFieldKey(): string {
  return `field_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

const ARCHETYPE_PRESETS: Record<string, any[]> = {
  loyalty: [
    { id: 'row1', columns: [{ key: 'points', header: 'Points', body: '500' }, { key: 'tier', header: 'Tier', body: 'Gold' }] }
  ],
  membership: [
    { id: 'row1', columns: [{ key: 'member_id', header: 'Member ID', body: '100492' }, { key: 'status', header: 'Status', body: 'Active' }] },
    { id: 'row2', columns: [{ key: 'home_club', header: 'Home Club', body: 'YMCA' }, { key: 'expires', header: 'Expires', body: '12/2026' }] }
  ],
  id_card: [
    { id: 'row1', columns: [{ key: 'employee_id', header: 'Employee ID', body: 'EMP-992' }, { key: 'role', header: 'Role', body: 'Developer' }] },
    { id: 'row2', columns: [{ key: 'department', header: 'Department', body: 'Engineering' }, { key: 'valid_thru', header: 'Valid Thru', body: '12/2026' }] }
  ],
  access_badge: [
    { id: 'row1', columns: [{ key: 'event', header: 'Event', body: 'VIP Access' }, { key: 'date', header: 'Date', body: 'Oct 31' }] },
    { id: 'row2', columns: [{ key: 'gate', header: 'Gate', body: 'A1' }, { key: 'section', header: 'Section', body: '10' }, { key: 'seat', header: 'Seat', body: '5F' }] }
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
  selectedTenantId,
  passCount = 0
}: any) {
  const [fieldsExpanded, setFieldsExpanded] = React.useState(true);
  const [tiersExpanded, setTiersExpanded] = React.useState(false);

  // Any design edit invalidates whatever is currently published (or makes an
  // unsaved template as-yet-unpublished), so every mutation routes through
  // here to re-enable the Publish button — previously only the archetype
  // buttons did this, so a colour-only change couldn't be republished.
  const updateDesignData = (updater: any) => {
    setDesignData((prev: any) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      return next;
    });
    setTemplateStatus((prev: any) => (prev === 'published' ? 'draft' : prev));
  };

  const addRow = () => {
    if (designData.rows.length >= 3) return;
    updateDesignData({
      ...designData,
      rows: [...designData.rows, { id: `row${Date.now()}`, columns: [{ key: generateFieldKey(), header: 'New Field', body: 'Value' }] }]
    });
  };

  const removeRow = (rowId: string) => {
    updateDesignData({ ...designData, rows: designData.rows.filter((r: any) => r.id !== rowId) });
  };

  const addColumn = (rowId: string) => {
    const newRows = designData.rows.map((r: any) => {
      if (r.id === rowId && r.columns.length < 3) {
        return { ...r, columns: [...r.columns, { key: generateFieldKey(), header: 'New Field', body: 'Value' }] };
      }
      return r;
    });
    updateDesignData({ ...designData, rows: newRows });
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
    updateDesignData({ ...designData, rows: newRows });
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
    updateDesignData({ ...designData, rows: newRows });
  };

  const tierThresholds: Array<{ name: string; min: number }> = designData.tierThresholds || [];

  const addTier = () => {
    updateDesignData({ ...designData, tierThresholds: [...tierThresholds, { name: '', min: 0 }] });
  };

  const updateTier = (
    index: number,
    field: 'name' | 'min',
    value: string,
  ) => {
    const next = [...tierThresholds];
    next[index] = {
      ...next[index],
      [field]: field === 'min' ? Number(value) || 0 : value,
    };
    updateDesignData({ ...designData, tierThresholds: next });
  };

  const removeTier = (index: number) => {
    updateDesignData({ ...designData, tierThresholds: tierThresholds.filter((_, i) => i !== index) });
  };

  const storeLocations: Array<{ id?: string; latitude: string; longitude: string; label: string }> =
    designData.storeLocations || [];

  const addLocation = () => {
    if (storeLocations.length >= 10) return;
    updateDesignData({
      ...designData,
      storeLocations: [...storeLocations, { latitude: '', longitude: '', label: '' }],
    });
  };

  const updateLocation = (
    index: number,
    fieldOrUpdates: 'latitude' | 'longitude' | 'label' | Record<string, string>,
    value?: string,
  ) => {
    const next = [...storeLocations];
    if (typeof fieldOrUpdates === 'string') {
      next[index] = { ...next[index], [fieldOrUpdates]: value };
    } else {
      next[index] = { ...next[index], ...fieldOrUpdates };
    }
    updateDesignData({ ...designData, storeLocations: next });
  };

  const removeLocation = (index: number) => {
    updateDesignData({ ...designData, storeLocations: storeLocations.filter((_, i) => i !== index) });
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
            tierThresholds,
            storeLocations,
            hexBackgroundColor: designData.hexBackgroundColor,
            logoUrl: designData.logoUrl || null,
            heroImageUrl: designData.heroImageUrl || null,
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
            tierThresholds,
            storeLocations,
            hexBackgroundColor: designData.hexBackgroundColor,
            logoUrl: designData.logoUrl || null,
            heroImageUrl: designData.heroImageUrl || null,
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
            tierThresholds,
            storeLocations,
            hexBackgroundColor: designData.hexBackgroundColor,
            logoUrl: designData.logoUrl || null,
            heroImageUrl: designData.heroImageUrl || null,
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
            tierThresholds,
            storeLocations,
            hexBackgroundColor: designData.hexBackgroundColor,
            logoUrl: designData.logoUrl || null,
            heroImageUrl: designData.heroImageUrl || null,
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

  const handleResyncPasses = async () => {
    if (!savedTemplateId) return;
    const resyncPromise = async () => {
      const data = await apiClient(`/templates/${savedTemplateId}/resync-passes`, {
        method: 'POST',
      });
      if (!data.success) throw new Error(data.error || 'Failed to resync passes');
      return data;
    };

    toast.promise(resyncPromise(), {
      loading: 'Pushing design to existing passes...',
      success: (data: any) => `Updated ${data.succeeded}/${data.total} existing passes.`,
      error: (err: any) => err.message || 'Resync failed'
    });
  };

  return (
    <div className="flex flex-col gap-8 w-full max-w-3xl">


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
          <Input type="text" value={designData.cardTitle} onChange={(e) => updateDesignData({...designData, cardTitle: e.target.value})} className="mt-2" required/>
        </div>

        <div className="space-y-2">
          <Label className="text-xs font-semibold text-ink-dark uppercase tracking-wide">Pass Template Type</Label>
          <div className="grid grid-cols-4 gap-2 mt-2">
            {ARCHETYPES.map((arch) => {
              const Icon = arch.icon;
              return (
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
                  className={`flex flex-col items-center justify-center gap-1.5 py-3 px-2 rounded-lg text-[11px] font-medium border transition-all ${
                    designData.archetype === arch.value
                      ? 'bg-brand-blue/10 border-brand-blue text-brand-blue'
                      : 'bg-surface-card border-border-subtle text-ink-secondary hover:border-border-strong'
                  }`}>
                  <Icon className="w-4 h-4" strokeWidth={1.75} />
                  {arch.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-ink-dark uppercase tracking-wide">Logo Asset URL</Label>
            <div className="flex items-center gap-2 mt-1">
              <div className="w-9 h-9 shrink-0 rounded-lg border border-border-subtle bg-canvas overflow-hidden flex items-center justify-center">
                {designData.logoUrl ? (
                  <img src={designData.logoUrl} alt="Logo preview" className="w-full h-full object-cover" onError={(e) => (e.currentTarget.style.visibility = 'hidden')} />
                ) : (
                  <ImageOff className="w-4 h-4 text-ink-muted" strokeWidth={1.75} />
                )}
              </div>
              <Input type="text" value={designData.logoUrl} onChange={(e) => updateDesignData({...designData, logoUrl: e.target.value})} placeholder="https://..." className="font-mono text-sm"/>
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-ink-dark uppercase tracking-wide">Hero Cover URL</Label>
            <div className="flex items-center gap-2 mt-1">
              <div className="w-9 h-9 shrink-0 rounded-lg border border-border-subtle bg-canvas overflow-hidden flex items-center justify-center">
                {designData.heroImageUrl ? (
                  <img src={designData.heroImageUrl} alt="Hero preview" className="w-full h-full object-cover" onError={(e) => (e.currentTarget.style.visibility = 'hidden')} />
                ) : (
                  <ImageOff className="w-4 h-4 text-ink-muted" strokeWidth={1.75} />
                )}
              </div>
              <Input type="text" value={designData.heroImageUrl} onChange={(e) => updateDesignData({...designData, heroImageUrl: e.target.value})} placeholder="https://..." className="font-mono text-sm"/>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-xs font-semibold text-ink-dark uppercase tracking-wide">Brand Palette</Label>
          <div className="flex flex-wrap items-center gap-4 mt-2">
            {COLOR_PALETTE.map((c) => (
              <button
                key={c.hex} type="button" title={`${c.name} — ${c.hex}`}
                onClick={() => updateDesignData({...designData, hexBackgroundColor: c.hex})}
                className={`w-8 h-8 rounded-full border-2 transition-all ${designData.hexBackgroundColor === c.hex ? 'border-white dark:border-zinc-300 scale-110 shadow-sm' : 'border-transparent opacity-60 hover:scale-105 hover:opacity-100'}`}
                style={{backgroundColor: c.hex}}
              />
            ))}
            <div
              className={`relative w-8 h-8 rounded-full border-2 border-dashed overflow-hidden transition-all flex items-center justify-center bg-canvas ${!COLOR_PALETTE.find(c => c.hex === designData.hexBackgroundColor) ? 'border-white dark:border-zinc-300 scale-110 shadow-sm' : 'border-border-strong opacity-70 hover:opacity-100 hover:scale-105 hover:border-brand-blue/50'}`}
              title={`Custom Color — ${designData.hexBackgroundColor}`}
            >
              <input
                type="color"
                value={designData.hexBackgroundColor}
                onChange={(e) => updateDesignData({...designData, hexBackgroundColor: e.target.value})}
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

        <div className="bg-surface-card rounded-xl border border-border-subtle shadow-sm">
          <button type="button" onClick={() => setFieldsExpanded(!fieldsExpanded)} className="w-full flex items-center justify-between p-6 pb-5">
              <span className="flex items-center gap-2 text-xs font-semibold text-ink-dark uppercase tracking-wide">
                <ChevronDown className={`w-4 h-4 text-ink-muted transition-transform ${fieldsExpanded ? 'rotate-180' : ''}`} strokeWidth={1.75} />
                Dynamic Fields Architecture
              </span>
              {fieldsExpanded && (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => { e.stopPropagation(); addRow(); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); addRow(); } }}
                  className={`text-xs font-semibold text-brand-blue hover:text-brand-blue-hover transition-colors flex items-center gap-1 ${designData.rows.length >= 3 ? 'opacity-50 pointer-events-none' : ''}`}
                >
                  <Plus className="w-4 h-4" /> Add Row
                </span>
              )}
          </button>
          {fieldsExpanded && (
          <div className="px-6 pb-6 space-y-5">
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
          )}
        </div>

        <div className="mt-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold text-ink-dark">
              Store Locations ({storeLocations.length}/10 locations)
            </h3>
            <button
              type="button"
              onClick={addLocation}
              disabled={storeLocations.length >= 10}
              className="text-xs font-semibold text-brand-blue hover:text-brand-blue-hover transition-colors disabled:opacity-50"
            >
              + Add Location
            </button>
          </div>
          <p className="text-xs text-ink-muted mb-3">
            Up to 10 outlet pins for Google Wallet's proximity notifications
            (~150m radius). The notification text is Google's own and cannot
            be customised. Delivery requires the customer to have "Allow all
            the time" location access and the Nearby Passes toggle enabled —
            neither LinearCard nor the merchant can grant this on their behalf.
          </p>
          {storeLocations.length > 0 && (
            <div className="space-y-3">
              {storeLocations.map((loc, idx) => (
                <StoreLocationEntry
                  key={idx}
                  index={idx}
                  location={loc}
                  onUpdate={updateLocation}
                  onRemove={removeLocation}
                />
              ))}
            </div>
          )}
        </div>

        <div className="mt-6 bg-surface-card rounded-xl border border-border-subtle shadow-sm">
          <button type="button" onClick={() => setTiersExpanded(!tiersExpanded)} className="w-full flex items-center justify-between p-4">
            <span className="flex items-center gap-2 text-xs font-semibold text-ink-dark">
              <ChevronDown className={`w-4 h-4 text-ink-muted transition-transform ${tiersExpanded ? 'rotate-180' : ''}`} strokeWidth={1.75} />
              Tier Thresholds {tierThresholds.length > 0 ? `(${tierThresholds.length})` : ''}
            </span>
            {tiersExpanded && (
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => { e.stopPropagation(); addTier(); }}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); addTier(); } }}
                className="text-xs font-semibold text-brand-blue hover:text-brand-blue-hover transition-colors"
              >
                + Add Tier
              </span>
            )}
          </button>
          {tiersExpanded && (
            <div className="px-4 pb-4">
              <p className="text-xs text-ink-muted mb-3">
                Members are auto-promoted to a tier once their points balance
                reaches its minimum, on every scan transaction.
              </p>
              {tierThresholds.map((tier, idx) => (
                <div key={idx} className="flex items-center gap-2 mb-2">
                  <input
                    type="text"
                    value={tier.name}
                    onChange={(e) => updateTier(idx, 'name', e.target.value)}
                    placeholder="Tier name (e.g. Gold)"
                    className="text-sm flex-1 bg-canvas border border-border-subtle rounded-md px-2 py-1 text-ink-dark placeholder:text-ink-muted outline-none"
                  />
                  <input
                    type="number"
                    min={0}
                    value={tier.min}
                    onChange={(e) => updateTier(idx, 'min', e.target.value)}
                    placeholder="Min points"
                    className="text-sm w-32 bg-canvas border border-border-subtle rounded-md px-2 py-1 text-ink-dark placeholder:text-ink-muted outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => removeTier(idx)}
                    className="text-ink-muted hover:text-red-500 transition-colors"
                    aria-label="Remove tier"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="sticky bottom-0 -mx-1 px-1 pt-4 pb-1 bg-linear-to-t from-canvas via-canvas/95 to-transparent">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-t border-border-subtle pt-4 gap-4">
          <div>
            {templateStatus !== 'unsaved' && (
              <Badge tone={templateStatus === 'published' ? 'success' : 'warning'}>
                {templateStatus === 'published' ? 'Published Live' : 'Draft Saved'}
              </Badge>
            )}
          </div>
          <div className="flex gap-3 flex-wrap justify-end">
            {templateStatus === 'published' && savedTemplateId && (
              <Button type="button" variant="secondary" onClick={handleResyncPasses} className="flex-1 sm:flex-none">
                Sync Existing Passes {passCount > 0 ? `(${passCount})` : ''}
              </Button>
            )}
            {templateStatus !== 'published' && (
              <Button type="button" variant="secondary" onClick={handleSaveDraft} className="flex-1 sm:flex-none">
                Save Draft
              </Button>
            )}
            <Button type="button" disabled={templateStatus === 'published'} onClick={handlePublish} className="flex-1 sm:flex-none">
              Publish Template
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
