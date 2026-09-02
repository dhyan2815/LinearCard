'use client';
import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Label } from '@/components/ui/Label';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Activity, ArrowRight, Zap } from 'lucide-react';

export function LiveManageView({
  tenantId,
  manageData,
  setManageData,
  handleUpdatePass,
  loading,
  error,
  successMsg,
  passHistory,
  selectPassForManage
}: any) {
  const [logs, setLogs] = useState<any[]>([]);
  
  useEffect(() => {
    if (!tenantId) return;
    fetch(`/api/notifications/log?tenantId=${tenantId}&limit=20`)
      .then(r => r.json())
      .then(d => { if (d.success) setLogs(d.logs); })
      .catch(err => console.error('Error fetching logs:', err));
  }, [tenantId, successMsg]);

  return (
    <div className="max-w-5xl space-y-6">
      <div className="border-b border-border-subtle pb-4 mb-4">
        <h2 className="text-xl font-medium text-ink-dark tracking-tight">Live Updates</h2>
        <p className="text-sm text-ink-secondary mt-1">Select a pass from the current session to push instant patch updates over-the-air.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Live Update (Manage) */}
        <Card className="flex flex-col border-border-subtle shadow-sm bg-surface-card overflow-hidden">
          <div className="p-4 border-b border-border-subtle bg-canvas/50 flex justify-between items-center">
            <h2 className="text-[14px] font-semibold text-ink-dark flex items-center gap-2">
              <Zap className="w-4 h-4 text-brand-blue" /> Pass Patcher
            </h2>
            {manageData.passId && (
              <button onClick={() => setManageData({...manageData, passId: ''})} className="text-xs text-ink-muted hover:text-ink-dark">Cancel</button>
            )}
          </div>
          <div className="p-5 space-y-4 flex-1">
             {manageData.passId ? (
               <form onSubmit={handleUpdatePass} className="space-y-4">
                 <div>
                    <Label className="text-xs text-ink-secondary uppercase tracking-wide">Update Tier</Label>
                    <Input type="text" value={manageData.tier} onChange={(e: any) => setManageData({...manageData, tier: e.target.value})} required className="h-10 text-sm mt-1.5"/>
                  </div>
                  <div>
                    <Label className="text-xs text-ink-secondary uppercase tracking-wide">Update Balance</Label>
                    <Input type="text" value={manageData.balance} onChange={(e: any) => setManageData({...manageData, balance: e.target.value})} required className="h-10 text-sm mt-1.5"/>
                  </div>
                  <div>
                    <Label className="text-xs text-ink-secondary uppercase tracking-wide">Push Notification (Optional)</Label>
                    <Input type="text" value={manageData.pushNotification} onChange={(e: any) => setManageData({...manageData, pushNotification: e.target.value})} placeholder="Message" className="h-10 text-sm mt-1.5"/>
                  </div>
                  <Button type="submit" disabled={loading} className="w-full h-10 mt-2">
                    {loading ? 'Patching...' : 'Push Live Update'}
                  </Button>
                  {error && <p className="text-red-500 text-xs">{error}</p>}
                  {successMsg && <p className="text-emerald-500 text-xs">{successMsg}</p>}
               </form>
             ) : (
               <div className="space-y-3 h-full flex flex-col">
                 <p className="text-sm text-ink-muted">Select a pass from your local session history.</p>
                 <div className="space-y-2 overflow-y-auto flex-1 pr-2 max-h-64">
                   {passHistory.length === 0 && <p className="text-sm text-ink-muted italic">No passes issued yet.</p>}
                   {passHistory.map((item: any, idx: number) => (
                      <div
                        key={idx}
                        onClick={() => selectPassForManage(item)}
                        className="p-3 rounded-lg border flex items-center justify-between cursor-pointer transition-colors group bg-canvas border-border-subtle hover:border-border-strong"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{backgroundColor: item.passData?.hexBackgroundColor || '#1A365D'}}/>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-ink-dark truncate">
                              {item.passData?.memberName}
                            </p>
                            <p className="text-xs text-ink-muted font-mono truncate mt-0.5">
                              {item.fullPassId || item.passId}
                            </p>
                          </div>
                        </div>
                        <ArrowRight className="w-4 h-4 text-ink-muted group-hover:text-ink-secondary" />
                      </div>
                    ))}
                 </div>
               </div>
             )}
          </div>
        </Card>

        {/* Activity Ledger */}
        <Card className="flex flex-col border-border-subtle shadow-sm bg-surface-card overflow-hidden h-full max-h-125">
          <div className="p-4 border-b border-border-subtle bg-canvas/50">
            <h2 className="text-[14px] font-semibold text-ink-dark flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-500" /> Activity Ledger
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto p-5 space-y-3">
            {logs.length === 0 && <p className="text-sm text-ink-muted py-4">No recent activity.</p>}
            {logs.map((log: any) => (
              <div key={log.id} className="p-3 rounded-xl border border-border-subtle/50 bg-canvas transition-colors flex gap-3 items-start">
                <div className={`mt-1.5 shrink-0 w-2 h-2 rounded-full ${log.status === 'sent' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                <div className="flex-1 min-w-0">
                   <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-ink-dark capitalize truncate">{log.type}</p>
                      <span className="text-xs text-ink-muted font-mono shrink-0">
                        {new Date(log.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                   </div>
                   <p className="text-xs text-ink-secondary mt-1 truncate">
                      {log.channel === 'whatsapp' ? '💬 WhatsApp' : '🔔 Wallet Push'} • {log.member?.name || log.member?.phone || 'Unknown'}
                   </p>
                   {log.error && <p className="text-red-400 text-xs mt-1">{log.error}</p>}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
