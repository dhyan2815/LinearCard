'use client';
import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { ArrowLeft, ShieldCheck, History, Edit3 } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import Link from 'next/link';

export default function MemberDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [member, setMember] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedPassId, setSelectedPassId] = useState('');
  const [newBalance, setNewBalance] = useState('');
  const [newTier, setNewTier] = useState('');
  const [note, setNote] = useState('');
  const [isAdjusting, setIsAdjusting] = useState(false);
  const [adjustMsg, setAdjustMsg] = useState('');

  const loadMember = async () => {
    const previousPassId = selectedPassId; // capture before async fetch resets state
    const data = await (await fetch(`/api/members/${id}`)).json();
    if (data.success) {
      setMember(data.member);
      if (data.member.passes?.length > 0) {
        // Preserve the admin's current selection; fall back to passes[0] on initial load
        const passStillExists = data.member.passes.some((p: any) => p.id === previousPassId);
        const targetPass = passStillExists
          ? data.member.passes.find((p: any) => p.id === previousPassId)!
          : data.member.passes[0];
        setSelectedPassId(targetPass.id);
        setNewBalance(String(targetPass.balance));
        setNewTier(targetPass.tier || '');
      }
    } else setError(data.error || 'Failed to load member');
    setLoading(false);
  };

  useEffect(() => {
    loadMember();
  }, [id]);

  const handleAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPassId) return;
    setIsAdjusting(true);
    setAdjustMsg('');
    try {
      const res = await fetch(`/api/members/${id}/adjust-balance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passId: selectedPassId, newBalance: parseInt(newBalance, 10), newTier, note }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setAdjustMsg('Balance adjusted. Wallet pass will update shortly.');
      await loadMember();
    } catch (err: any) {
      setAdjustMsg(`Error: ${err.message}`);
    } finally {
      setIsAdjusting(false);
    }
  };

  if (loading) {
    return (
      <main className="flex-1 flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-brand-orange/30 border-t-brand-orange rounded-full animate-spin" />
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex-1 flex items-center justify-center py-20">
        <p className="text-red-500 font-medium">{error}</p>
      </main>
    );
  }

  return (
    <main className="flex-1 max-w-4xl w-full mx-auto px-6 py-8 space-y-6">
      <Link href="/dashboard/members" className="inline-flex items-center gap-2 text-sm text-ink-secondary hover:text-ink-dark transition-colors font-medium">
        <ArrowLeft className="w-4 h-4" /> Back to Members
      </Link>

      <Card className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-ink-dark tracking-tight">{member.name || 'Unknown Member'}</h1>
            <p className="text-ink-secondary font-mono text-sm mt-1">{member.phone}</p>
          </div>
          {member.consentedAt && (
            <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-md border border-emerald-500/20">
              <ShieldCheck className="w-3.5 h-3.5" /> DPDP Consented
            </div>
          )}
        </div>
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div className="bg-canvas p-3 rounded-xl border border-border-subtle">
            <p className="text-[10px] font-bold text-ink-secondary uppercase tracking-widest mb-1">Enrolled</p>
            <p className="text-sm font-medium text-ink-dark">{new Date(member.createdAt).toLocaleDateString()}</p>
          </div>
          <div className="bg-canvas p-3 rounded-xl border border-border-subtle">
            <p className="text-[10px] font-bold text-ink-secondary uppercase tracking-widest mb-1">Passes</p>
            <p className="text-sm font-medium text-ink-dark">{member.passes?.length ?? 0}</p>
          </div>
          {member.passes?.[0] && (
            <div className="bg-canvas p-3 rounded-xl border border-border-subtle">
              <p className="text-[10px] font-bold text-ink-secondary uppercase tracking-widest mb-1">Balance</p>
              <p className="text-sm font-medium text-ink-dark">{member.passes[0].balance} pts • {member.passes[0].tier}</p>
            </div>
          )}
        </div>
      </Card>

      {member.passes?.length > 0 && (
        <Card className="p-6">
          <h2 className="text-base font-semibold text-ink-dark flex items-center gap-2 mb-4">
            <Edit3 className="w-4 h-4 text-brand-orange" /> Adjust Balance
          </h2>
          <form onSubmit={handleAdjust} className="space-y-4">
            {member.passes.length > 1 && (
              <div className="space-y-1">
                <Label>Select Pass</Label>
                <select
                  value={selectedPassId}
                  onChange={(e) => {
                    setSelectedPassId(e.target.value);
                    const p = member.passes.find((p: any) => p.id === e.target.value);
                    if (p) {
                      setNewBalance(String(p.balance));
                      setNewTier(p.tier || '');
                    }
                  }}
                  className="w-full bg-surface-card border border-border-subtle rounded-lg px-3 py-2 text-sm text-ink-dark focus:outline-none focus:border-brand-orange"
                >
                  {member.passes.map((p: any) => (
                    <option key={p.id} value={p.id}>{p.fullPassId} — {p.balance} pts</option>
                  ))}
                </select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>New Balance (pts)</Label>
                <Input type="number" min="0" value={newBalance} onChange={(e) => setNewBalance(e.target.value)} required />
              </div>
              <div className="space-y-1">
                <Label>New Tier</Label>
                <Input type="text" value={newTier} onChange={(e) => setNewTier(e.target.value)} placeholder="e.g. Gold" />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Admin Note (audit trail)</Label>
              <Input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Bonus for feedback survey" />
            </div>
            {adjustMsg && <p className={`text-sm font-medium ${adjustMsg.startsWith('Error') ? 'text-red-500' : 'text-emerald-400'}`}>{adjustMsg}</p>}
            <Button type="submit" disabled={isAdjusting || !newBalance} className="w-full">
              {isAdjusting ? 'Applying...' : 'Apply Adjustment'}
            </Button>
          </form>
        </Card>
      )}

      {member.auditLog?.length > 0 && (
        <Card className="p-6">
          <h2 className="text-base font-semibold text-ink-dark flex items-center gap-2 mb-4">
            <History className="w-4 h-4 text-brand-orange" /> Audit Trail
          </h2>
          <div className="space-y-1">
            {member.auditLog.map((entry: any) => {
              const prev = entry.previousValue || entry.details?.previousValue;
              const next = entry.newValue || entry.details?.newValue;
              const entryNote = entry.note || entry.details?.note;
              return (
                <div key={entry.id} className="flex items-start gap-3 py-3 border-b border-border-subtle/50 last:border-0">
                  <div className="w-2 h-2 rounded-full bg-brand-orange mt-2 shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-ink-dark capitalize">{entry.action.replace(/_/g, ' ')}</p>
                    {prev && next && (
                      <p className="text-xs text-ink-secondary">
                        {prev.balance} -&gt; {next.balance} pts
                        {prev.tier !== next.tier ? ` • ${prev.tier} -&gt; ${next.tier}` : ''}
                      </p>
                    )}
                    {entryNote && <p className="text-xs text-ink-muted italic">{entryNote}</p>}
                    <p className="text-xs text-ink-muted mt-0.5">{new Date(entry.createdAt).toLocaleString()}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {member.consentLog?.length > 0 && (
        <Card className="p-6">
          <h2 className="text-base font-semibold text-ink-dark flex items-center gap-2 mb-4">
            <ShieldCheck className="w-4 h-4 text-brand-orange" /> Consent Records
          </h2>
          <div className="space-y-2">
            {member.consentLog.map((entry: any) => (
              <div key={entry.id} className="text-sm text-ink-secondary py-2 border-b border-border-subtle/50 last:border-0">
                <span className="text-emerald-400 font-medium">Consented</span> — {entry.legalTextVersion} • {new Date(entry.consentedAt).toLocaleString()}
                {entry.ipAddress && <span className="text-ink-muted ml-2 text-xs">from {entry.ipAddress}</span>}
              </div>
            ))}
          </div>
        </Card>
      )}
    </main>
  );
}
