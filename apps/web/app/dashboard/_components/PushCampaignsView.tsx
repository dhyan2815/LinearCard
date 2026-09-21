'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { Label } from '@/components/ui/Label';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Alert } from '@/components/ui/Alert';
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog';
import { MessageCircle, Bell, Smartphone, Users, AlertTriangle } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import type { AudienceFilter, Campaign } from '@linearcard/types';

type Channel = 'whatsapp' | 'wallet_push';

interface Preview {
  recipientCount: number;
  optedOutCount: number;
  renderedHeader?: string | null;
  renderedBody: string;
  sample: Array<{ id: string; name?: string; phone: string; tier?: string; balance?: any }>;
}

/** Empty strings are what the inputs hold; the API wants numbers or nothing. */
const num = (v: string) => (v.trim() === '' ? undefined : Number(v));

export function PushCampaignsView({ tenantId }: { tenantId: string }) {
  const [channel, setChannel] = useState<Channel>('whatsapp');
  const [name, setName] = useState('');
  const [header, setHeader] = useState('');
  const [message, setMessage] = useState('');

  // Audience (2.2)
  const [tiers, setTiers] = useState('');
  const [balanceMin, setBalanceMin] = useState('');
  const [balanceMax, setBalanceMax] = useState('');
  const [inactiveForDays, setInactiveForDays] = useState('');
  const [testAccountsOnly, setTestAccountsOnly] = useState(false);

  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  // 7.4: a send is queued, not completed, by the time this request returns.
  const [result, setResult] = useState<{ queued: number } | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const audienceFilter: AudienceFilter = {
    tiers: tiers.trim()
      ? tiers.split(',').map(t => t.trim()).filter(Boolean)
      : undefined,
    balanceMin: num(balanceMin),
    balanceMax: num(balanceMax),
    inactiveForDays: num(inactiveForDays),
    testAccountsOnly: testAccountsOnly || undefined,
  };
  const filterKey = JSON.stringify(audienceFilter);

  const composerReady =
    !!tenantId && !!message.trim() && (channel !== 'wallet_push' || !!header.trim());

  const loadCampaigns = useCallback(() => {
    if (!tenantId) return;
    apiClient(`/campaigns?tenantId=${tenantId}&limit=15&_t=${Date.now()}`)
      .then(d => { if (d.success) setCampaigns(d.campaigns); })
      .catch(() => {});
  }, [tenantId]);

  useEffect(() => { loadCampaigns(); }, [loadCampaigns, result]);

  // Dry run (2.5): recount whenever the audience or the message changes, so
  // the number on the Send button is never stale.
  useEffect(() => {
    if (!composerReady) { setPreview(null); return; }
    let cancelled = false;
    const timer = setTimeout(() => {
      setPreviewError(null);
      apiClient('/campaigns/preview', {
        method: 'POST',
        body: JSON.stringify({ tenantId, channel, header, body: message, audienceFilter }),
      })
        .then(d => { if (!cancelled && d.success) setPreview(d); })
        .catch(err => { if (!cancelled) { setPreview(null); setPreviewError(err.message); } });
    }, 400);
    return () => { cancelled = true; clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, channel, header, message, filterKey, composerReady]);

  const handleSend = async () => {
    setConfirmOpen(false);
    setIsSending(true); setResult(null); setSendError(null);
    try {
      const data = await apiClient('/campaigns', {
        method: 'POST',
        body: JSON.stringify({ tenantId, name, channel, header, body: message, audienceFilter }),
      });
      if (!data.success) throw new Error(data.error || 'Failed to send');
      setResult({ queued: data.recipientCount ?? 0 });
      setMessage(''); setHeader(''); setName('');
      // Delivery counts land on the campaign row as the worker gets through
      // the audience, so the history below is what reports the outcome.
      [2000, 6000, 15000].forEach(ms => setTimeout(loadCampaigns, ms));
    } catch (err: any) {
      setSendError(err.message);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <div className="flex flex-col gap-8">
        <Card className="p-6 space-y-5">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-ink-dark uppercase tracking-wide">Delivery Channel</Label>
            <div className="flex gap-2 mt-2">
              {(['whatsapp', 'wallet_push'] as const).map(ch => (
                <button key={ch} type="button" onClick={() => setChannel(ch)}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border transition-all ${
                    channel === ch ? 'bg-brand-blue/10 border-brand-blue text-brand-blue'
                      : 'bg-canvas border-border-subtle text-ink-secondary hover:border-border-strong'
                  }`}>
                  {ch === 'whatsapp' ? '💬 WhatsApp' : '🔔 Wallet Push'}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-ink-dark uppercase tracking-wide">Campaign Name</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Weekend double points" className="mt-2" />
          </div>

          {/* FE-2: Google Wallet's addMessage requires a header. */}
          {channel === 'wallet_push' && (
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-ink-dark uppercase tracking-wide">Notification Header *</Label>
              <Input value={header} onChange={e => setHeader(e.target.value)} placeholder="Double points this weekend" className="mt-2" />
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-ink-dark uppercase tracking-wide">Message Payload</Label>
            <textarea value={message} onChange={e => setMessage(e.target.value)}
              placeholder={channel === 'whatsapp' ? 'e.g. Earn double points this weekend!' : 'e.g. Your pass has been updated.'}
              rows={4} className="w-full rounded-xl border border-border-subtle bg-canvas text-ink-dark text-sm px-4 py-3 focus:outline-none focus:border-brand-blue resize-none placeholder:text-ink-muted mt-2" />
          </div>
        </Card>

        {/* 2.2 — audience segmentation */}
        <Card className="p-6 space-y-4">
          <h3 className="text-xs font-semibold text-ink-dark uppercase tracking-wide flex items-center gap-2">
            <Users className="w-4 h-4 text-ink-muted" strokeWidth={1.75} /> Audience
          </h3>
          <div className="space-y-1.5">
            <Label className="text-xs text-ink-secondary">Tiers (comma separated, blank = any)</Label>
            <Input value={tiers} onChange={e => setTiers(e.target.value)} placeholder="Gold, Platinum" className="mt-1.5" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-ink-secondary">Min balance</Label>
              <Input type="number" value={balanceMin} onChange={e => setBalanceMin(e.target.value)} placeholder="0" className="mt-1.5" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-ink-secondary">Max balance</Label>
              <Input type="number" value={balanceMax} onChange={e => setBalanceMax(e.target.value)} placeholder="∞" className="mt-1.5" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-ink-secondary">Inactive for at least (days)</Label>
            <Input type="number" value={inactiveForDays} onChange={e => setInactiveForDays(e.target.value)} placeholder="21" className="mt-1.5" />
          </div>
          <label className="flex items-center gap-2 text-sm text-ink-secondary cursor-pointer">
            <input type="checkbox" checked={testAccountsOnly} onChange={e => setTestAccountsOnly(e.target.checked)} className="accent-brand-blue" />
            Test accounts only
          </label>
        </Card>
      </div>

      <div className="flex flex-col gap-8">
        {/* 2.5 — dry run */}
        <Card className="p-6 h-fit shrink-0">
          <h3 className="text-xs font-semibold text-ink-dark uppercase tracking-wide mb-4 flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-ink-muted" strokeWidth={1.75} /> Preview Send
          </h3>

          {channel === 'whatsapp' ? (
            <div className="rounded-2xl bg-[#0b141a] p-4">
              <div className="max-w-[85%] ml-auto rounded-lg rounded-tr-none bg-[#005c4b] text-white text-sm px-3 py-2 shadow flex items-start gap-2">
                <MessageCircle className="w-4 h-4 shrink-0 mt-0.5 opacity-70" />
                <p className="whitespace-pre-wrap wrap-break-word">{message.trim() || 'Your message will appear here...'}</p>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl bg-canvas border border-border-subtle p-4">
              <div className="flex items-center gap-2 rounded-xl border border-border-subtle bg-surface-card p-3 shadow-sm">
                <div className="w-8 h-8 rounded-lg bg-brand-blue/10 flex items-center justify-center shrink-0">
                  <Bell className="w-4 h-4 text-brand-blue" strokeWidth={1.75} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-ink-dark">{header.trim() || 'Notification header'}</p>
                  <p className="text-xs text-ink-secondary truncate">{message.trim() || 'Your message will appear here...'}</p>
                </div>
              </div>
            </div>
          )}

          <div className="mt-4 space-y-3">
            {previewError && <Alert variant="error">{previewError}</Alert>}
            {preview && (
              <>
                <p className="text-sm text-ink-dark">
                  <strong className="font-semibold">{preview.recipientCount}</strong> recipient{preview.recipientCount === 1 ? '' : 's'} match this audience.
                  {preview.optedOutCount > 0 && (
                    <span className="text-ink-muted"> {preview.optedOutCount} opted out and will never receive it.</span>
                  )}
                </p>
                {preview.sample.length > 0 && (
                  <div className="rounded-xl border border-border-subtle bg-canvas divide-y divide-border-subtle/60 max-h-64 overflow-y-auto">
                    {preview.sample.map(r => (
                      <div key={r.id} className="flex items-center justify-between px-3 py-2 text-xs">
                        <span className="text-ink-dark truncate">{r.name || r.phone}</span>
                        <span className="text-ink-muted font-mono shrink-0">
                          {r.tier || '—'} · {r.balance ?? 0}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                {preview.recipientCount === 0 && (
                  <Alert variant="warning">No one matches this audience yet.</Alert>
                )}
              </>
            )}
            {result && (
              <Alert variant="success">Queued for {result.queued} members. Delivery progress appears in the history below.</Alert>
            )}
            {sendError && <Alert variant="error">{sendError}</Alert>}
            <Button
              onClick={() => setConfirmOpen(true)}
              disabled={!composerReady || isSending || !preview || preview.recipientCount === 0}
              className="w-full">
              {isSending
                ? 'Sending Broadcast...'
                : preview
                  ? `Send to ${preview.recipientCount} member${preview.recipientCount === 1 ? '' : 's'}`
                  : 'Send Broadcast'}
            </Button>
          </div>
        </Card>

        {campaigns.length > 0 && (
          <Card className="p-6 flex flex-col h-full max-h-125">
            <h3 className="text-base font-semibold text-ink-dark mb-4">Campaign History</h3>
            <div className="space-y-3 overflow-y-auto pr-2 flex-1">
              {campaigns.map(c => (
                <CampaignRow key={c.id} campaign={c} />
              ))}
            </div>
          </Card>
        )}
      </div>

      <ConfirmationDialog
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleSend}
        title="Dispatch Broadcast"
        confirmText={isSending ? 'Sending...' : 'Send Broadcast'}
        variant="default"
        isLoading={isSending}
        description={
          <span>
            This will send to{' '}
            <strong className="text-ink-dark font-semibold">
              {preview?.recipientCount ?? 0} member{preview?.recipientCount === 1 ? '' : 's'}
            </strong>{' '}
            via {channel === 'whatsapp' ? 'WhatsApp' : 'Wallet Push'}. This cannot be undone.
          </span>
        }
      />
    </div>
  );
}

/** One history row; expands to the per-cause failure breakdown (2.5). */
function CampaignRow({ campaign }: { campaign: Campaign }) {
  const [failures, setFailures] = useState<Record<string, number> | null>(null);
  const [open, setOpen] = useState(false);

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next && failures === null && campaign.failedCount > 0) {
      try {
        const d = await apiClient(`/campaigns/${campaign.id}`);
        if (d.success) setFailures(d.failures);
      } catch { setFailures({}); }
    }
  };

  return (
    <div className="p-3 rounded-xl bg-canvas border border-border-subtle/50 text-sm">
      <button type="button" onClick={toggle} className="w-full text-left">
        <div className="flex items-start gap-3">
          <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${campaign.status === 'sent' ? 'bg-emerald-500' : campaign.status === 'failed' ? 'bg-red-500' : 'bg-amber-500'}`} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <p className="text-ink-dark font-medium truncate">{campaign.name}</p>
              <span className="text-[10px] text-ink-muted font-mono shrink-0">
                {campaign.sentAt ? new Date(campaign.sentAt).toLocaleString([], { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}
              </span>
            </div>
            <p className="text-ink-secondary text-xs">
              {campaign.channel === 'whatsapp' ? '💬 WhatsApp' : '🔔 Wallet Push'} · {campaign.sentCount}/{campaign.recipientCount} delivered
              {campaign.failedCount > 0 && <span className="text-red-400"> · {campaign.failedCount} failed</span>}
            </p>
          </div>
        </div>
      </button>
      {open && campaign.failedCount > 0 && (
        <div className="mt-2 space-y-1">
          {failures === null && <p className="text-xs text-ink-muted">Loading failures…</p>}
          {failures && Object.entries(failures).map(([cause, count]) => (
            <div key={cause} className="flex items-start gap-2 text-xs bg-red-400/10 p-2 rounded-md">
              <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
              <span className="text-ink-secondary break-all">{cause}</span>
              <span className="ml-auto font-mono text-red-400 shrink-0">×{count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
