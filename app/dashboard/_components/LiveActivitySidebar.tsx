'use client';
import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Label } from '@/components/ui/Label';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Activity, ArrowRight, Zap, RefreshCw } from 'lucide-react';

export function LiveActivitySidebar({
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
    <div className="flex flex-col gap-6 h-full">
      {/* Activity Ledger */}
      <Card className="flex flex-col flex-1 min-h-75 border-zinc-200 dark:border-zinc-800 shadow-sm bg-white dark:bg-zinc-900 overflow-hidden">
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
          <h2 className="text-[14px] font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-500" /> Activity Ledger
          </h2>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {logs.length === 0 && <p className="text-xs text-zinc-500 text-center py-4">No recent activity.</p>}
          {logs.map((log: any) => (
            <div key={log.id} className="group p-3 rounded-xl border border-zinc-100 dark:border-zinc-800/60 bg-zinc-50 dark:bg-zinc-950 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-all duration-200 ease-in-out flex gap-3 items-start">
              <div className={`mt-1.5 shrink-0 w-2 h-2 rounded-full ${log.status === 'sent' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
              <div className="flex-1 min-w-0">
                 <div className="flex items-center justify-between gap-2">
                    <p className="text-[13px] font-medium text-zinc-900 dark:text-zinc-200 leading-snug capitalize truncate">{log.type}</p>
                    <span className="text-[10px] text-zinc-500 font-mono shrink-0">
                      {new Date(log.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                 </div>
                 <p className="text-[11px] text-zinc-500 mt-0.5 truncate">
                    {log.channel === 'whatsapp' ? '💬 WhatsApp' : '🔔 Wallet Push'} • {log.member?.name || log.member?.phone || 'Unknown'}
                 </p>
                 {log.error && <p className="text-rose-400 text-[11px] mt-0.5">{log.error}</p>}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Live Update (Manage) */}
      <Card className="flex flex-col border-zinc-200 dark:border-zinc-800 shadow-sm bg-white dark:bg-zinc-900 overflow-hidden">
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 flex justify-between items-center">
          <h2 className="text-[14px] font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <Zap className="w-4 h-4 text-brand-blue" /> Live Update
          </h2>
          {manageData.passId && (
            <button onClick={() => setManageData({...manageData, passId: ''})} className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">Cancel</button>
          )}
        </div>
        <div className="p-4 space-y-4">
           {manageData.passId ? (
             <form onSubmit={handleUpdatePass} className="space-y-4">
               <div>
                  <Label className="text-xs">Update Tier</Label>
                  <Input type="text" value={manageData.tier} onChange={(e: any) => setManageData({...manageData, tier: e.target.value})} required className="h-9 text-sm mt-1"/>
                </div>
                <div>
                  <Label className="text-xs">Update Balance</Label>
                  <Input type="text" value={manageData.balance} onChange={(e: any) => setManageData({...manageData, balance: e.target.value})} required className="h-9 text-sm mt-1"/>
                </div>
                <div>
                  <Label className="text-xs">Push Notification (Optional)</Label>
                  <Input type="text" value={manageData.pushNotification} onChange={(e: any) => setManageData({...manageData, pushNotification: e.target.value})} placeholder="Message" className="h-9 text-sm mt-1"/>
                </div>
                <Button type="submit" disabled={loading} className="w-full h-9 text-xs">
                  {loading ? 'Patching...' : 'Push Live Update'}
                </Button>
                {error && <p className="text-rose-500 text-[11px]">{error}</p>}
                {successMsg && <p className="text-emerald-500 text-[11px]">{successMsg}</p>}
             </form>
           ) : (
             <div className="space-y-3">
               <p className="text-[13px] text-zinc-500">Select a pass from the current session to update it live.</p>
               <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                 {passHistory.length === 0 && <p className="text-xs text-zinc-400 italic">No passes issued yet.</p>}
                 {passHistory.map((item: any, idx: number) => (
                    <div
                      key={idx}
                      onClick={() => selectPassForManage(item)}
                      className="p-2.5 rounded-lg border flex items-center justify-between cursor-pointer transition-colors group bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{backgroundColor: item.passData?.hexBackgroundColor || '#1A365D'}}/>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                            {item.passData?.memberName}
                          </p>
                          <p className="text-[10px] text-zinc-500 font-mono truncate mt-0.5">
                            {item.fullPassId || item.passId}
                          </p>
                        </div>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300" />
                    </div>
                  ))}
               </div>
             </div>
           )}
        </div>
      </Card>
    </div>
  );
}
