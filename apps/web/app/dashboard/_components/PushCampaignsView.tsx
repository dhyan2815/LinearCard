'use client';
import React, { useState, useEffect } from 'react';
import { Label } from '@/components/ui/Label';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Alert } from '@/components/ui/Alert';
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog';
import { MessageCircle, Bell, Smartphone } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

export function PushCampaignsView({ tenantId }: { tenantId: string }) {
  const [channel, setChannel] = useState<'whatsapp' | 'wallet_push'>('whatsapp');
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [result, setResult] = useState<{ sent: number; failed: number } | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [memberCount, setMemberCount] = useState<number | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    if (!tenantId) return;
    apiClient(`/notifications/log?tenantId=${tenantId}&limit=20&_t=${Date.now()}`)
      .then(d => { if (d.success) setLogs(d.logs); })
      .catch(err => console.error('Error fetching logs:', err));
    apiClient(`/dashboard/stats?tenantId=${tenantId}`)
      .then(d => { if (d.success) setMemberCount(d.stats?.memberCount ?? null); })
      .catch(() => {});
  }, [tenantId, result]);

  const handleSend = async () => {
    if (!tenantId || !message.trim()) return;
    setConfirmOpen(false);
    setIsSending(true); setResult(null); setSendError(null);
    try {
      const data = await apiClient('/notifications/send', {
        method: 'POST',
        body: JSON.stringify({ tenantId, channel, message }),
      });
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
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
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
            <Label className="text-xs font-semibold text-ink-dark uppercase tracking-wide">Message Payload</Label>
            <textarea value={message} onChange={e => setMessage(e.target.value)}
              placeholder={channel === 'whatsapp' ? 'e.g. Earn double points this weekend!' : 'e.g. Your pass has been updated.'}
              rows={4} className="w-full rounded-xl border border-border-subtle bg-canvas text-ink-dark text-sm px-4 py-3 focus:outline-none focus:border-brand-blue resize-none placeholder:text-ink-muted mt-2" />
          </div>
          {result && (
            <Alert variant="success">Sent to {result.sent} members.{result.failed > 0 ? ` ${result.failed} failed.` : ''}</Alert>
          )}
          {sendError && <Alert variant="error">{sendError}</Alert>}
          <Button onClick={() => setConfirmOpen(true)} disabled={!message.trim() || isSending || !tenantId} className="w-full">
            {isSending ? 'Sending Broadcast...' : 'Dispatch to All Members'}
          </Button>
        </Card>

        <div className="flex flex-col gap-8">
          <Card className="p-6">
            <h3 className="text-xs font-semibold text-ink-dark uppercase tracking-wide mb-4 flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-ink-muted" strokeWidth={1.75} /> Outgoing Preview
            </h3>
            {channel === 'whatsapp' ? (
              <div className="rounded-2xl bg-[#0b141a] p-4">
                <div className="max-w-[85%] ml-auto rounded-lg rounded-tr-none bg-[#005c4b] text-white text-sm px-3 py-2 shadow flex items-start gap-2">
                  <MessageCircle className="w-4 h-4 shrink-0 mt-0.5 opacity-70" />
                  <p className="whitespace-pre-wrap break-words">{message.trim() || 'Your message will appear here...'}</p>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl bg-canvas border border-border-subtle p-4 space-y-2">
                <div className="flex items-center gap-2 rounded-xl border border-border-subtle bg-surface-card p-3 shadow-sm">
                  <div className="w-8 h-8 rounded-lg bg-brand-blue/10 flex items-center justify-center shrink-0">
                    <Bell className="w-4 h-4 text-brand-blue" strokeWidth={1.75} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-ink-dark">Wallet Update</p>
                    <p className="text-xs text-ink-secondary truncate">{message.trim() || 'Your message will appear here...'}</p>
                  </div>
                </div>
              </div>
            )}
          </Card>

          {logs.length > 0 && (
          <Card className="p-6 flex flex-col h-full max-h-125">
            <h3 className="text-base font-semibold text-ink-dark mb-4">Recent Broadcasts</h3>
            <div className="space-y-3 overflow-y-auto pr-2 flex-1">
              {logs.map((log: any) => (
                <div key={log.id} className="flex items-start gap-3 p-3 rounded-xl bg-canvas border border-border-subtle/50 text-sm">
                  <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${log.status === 'sent' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-ink-dark font-medium truncate capitalize">{log.type.replace('_', ' ')}</p>
                      <span className="text-[10px] text-ink-muted font-mono shrink-0">
                        {new Date(log.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-ink-secondary text-xs truncate">
                      {log.channel === 'whatsapp' ? '💬 WhatsApp' : '🔔 Wallet Push'} • {log.member?.name || log.member?.phone || 'Unknown User'}
                    </p>
                   {(log.header || log.body) && (
                     <div className="mt-2 p-2.5 rounded-lg bg-surface/50 border border-border-subtle/30 text-xs">
                       {log.header && <p className="font-semibold text-ink-dark mb-0.5">{log.header}</p>}
                       {log.body && <p className="text-ink-secondary whitespace-pre-wrap">{log.body}</p>}
                     </div>
                   )}
                    {log.error && <p className="text-red-400 text-xs mt-1.5 bg-red-400/10 p-2 rounded-md break-all">{log.error}</p>}
                  </div>
                </div>
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
                {memberCount !== null ? `${memberCount} member${memberCount === 1 ? '' : 's'}` : 'all members'}
              </strong>{' '}
              of this brand via {channel === 'whatsapp' ? 'WhatsApp' : 'Wallet Push'}. This cannot be undone.
            </span>
          }
        />
    </div>
  );
}
