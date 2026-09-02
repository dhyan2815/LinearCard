'use client';
import React, { useState, useEffect } from 'react';
import { Label } from '@/components/ui/Label';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

export function BroadcastView({ tenantId }: { tenantId: string }) {
  const [channel, setChannel] = useState<'whatsapp' | 'wallet_push'>('whatsapp');
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [result, setResult] = useState<{ sent: number; failed: number } | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    if (!tenantId) return;
    fetch(`/api/notifications/log?tenantId=${tenantId}&limit=20`)
      .then(r => r.json())
      .then(d => { if (d.success) setLogs(d.logs); })
      .catch(err => console.error('Error fetching logs:', err));
  }, [tenantId, result]);

  const handleSend = async () => {
    if (!tenantId || !message.trim()) return;
    setIsSending(true); setResult(null); setSendError(null);
    try {
      const res = await fetch('/api/notifications/send', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, channel, message }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to send');
      setResult({ sent: data.sent, failed: data.failed });
      setMessage('');
    } catch (err: any) {
      setSendError(err.message);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="max-w-4xl space-y-6">
      <div className="border-b border-border-subtle pb-4 mb-4">
        <h2 className="text-xl font-medium text-ink-dark tracking-tight">Notifications Composer</h2>
        <p className="text-sm text-ink-secondary mt-1">Broadcast marketing updates or pass notifications across WhatsApp and Wallet Push.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="p-6 space-y-5 bg-surface-card border-border-subtle shadow-sm">
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
            <Label className="text-xs font-semibold text-ink-dark uppercase tracking-wide">Message Payload</Label>
            <textarea value={message} onChange={e => setMessage(e.target.value)}
              placeholder={channel === 'whatsapp' ? 'e.g. Earn double points this weekend!' : 'e.g. Your pass has been updated.'}
              rows={4} className="w-full rounded-xl border border-border-subtle bg-canvas text-ink-dark text-sm px-4 py-3 focus:outline-none focus:border-brand-blue resize-none placeholder:text-ink-muted mt-2" />
          </div>
          {result && <p className="text-sm text-emerald-500 font-medium">✅ Sent to {result.sent} members.{result.failed > 0 ? ` ${result.failed} failed.` : ''}</p>}
          {sendError && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-500 text-sm flex items-center gap-2">
              <span className="shrink-0">⚠</span> {sendError}
            </div>
          )}
          <Button onClick={handleSend} disabled={!message.trim() || isSending || !tenantId} className="w-full">
            {isSending ? 'Sending Broadcast...' : 'Dispatch to All Members'}
          </Button>
        </Card>

        {logs.length > 0 && (
          <Card className="p-6 bg-surface-card border-border-subtle shadow-sm flex flex-col h-full max-h-125">
            <h3 className="text-base font-semibold text-ink-dark mb-4">Recent Broadcasts</h3>
            <div className="space-y-3 overflow-y-auto pr-2 flex-1">
              {logs.map((log: any) => (
                <div key={log.id} className="flex items-start gap-3 p-3 rounded-xl bg-canvas border border-border-subtle/50 text-sm">
                  <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${log.status === 'sent' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-ink-dark font-medium truncate capitalize">{log.type}</p>
                      <span className="text-[10px] text-ink-muted font-mono shrink-0">
                        {new Date(log.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-ink-secondary text-xs truncate">
                      {log.channel === 'whatsapp' ? '💬 WhatsApp' : '🔔 Wallet Push'} • {log.member?.name || log.member?.phone || 'Unknown'}
                    </p>
                    {log.error && <p className="text-red-400 text-xs mt-0.5">{log.error}</p>}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
