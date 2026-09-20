'use client';
import React, { useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, ShieldCheck, History, Edit3, Trash2 } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Alert } from '@/components/ui/Alert';
import { PageShell } from '@/components/ui/PageShell';
import Link from 'next/link';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog';

export default function MemberDetailPage() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const [member, setMember] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedPassId, setSelectedPassId] = useState('');
  const [newBalance, setNewBalance] = useState('');
  const [newTier, setNewTier] = useState('');
  const [note, setNote] = useState('');
  const [isAdjusting, setIsAdjusting] = useState(false);
  const [adjustMsg, setAdjustMsg] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(searchParams.get('revoke') === '1');
  const router = useRouter();

  const loadMember = async () => {
    const previousPassId = selectedPassId; // capture before async fetch resets state
    try {
      const data = await apiClient(`/members/${id}`);
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
    } catch (err: any) {
      setError(err.message || 'Failed to load member');
    }
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
    const adjustPromise = async () => {
      try {
        const data = await apiClient(`/members/${id}/adjust-balance`, {
          method: 'POST',
          body: JSON.stringify({ passId: selectedPassId, newBalance: parseInt(newBalance, 10), newTier, note }),
        });
        if (!data.success) throw new Error(data.error || 'Failed to adjust balance');
        setAdjustMsg('Balance adjusted. Wallet pass will update shortly.');
        await loadMember();
        return data;
      } finally {
        setIsAdjusting(false);
      }
    };

    toast.promise(adjustPromise(), {
      loading: 'Updating balance & syncing wallet pass...',
      success: 'Balance adjusted successfully!',
      error: (err: any) => {
        setAdjustMsg(`Error: ${err.message}`);
        return `Error: ${err.message}`;
      },
    });
  };

  const handleDeleteClick = () => {
    setIsDeleteDialogOpen(true);
  };

  const handleCancelDelete = () => {
    if (isDeleting) return;
    setIsDeleteDialogOpen(false);
  };

  const handleConfirmDelete = async () => {
    setIsDeleting(true);

    const deletePromise = async () => {
      const data = await apiClient(`/members/${id}`, { method: 'DELETE' });
      if (!data.success) {
        throw new Error(data.error || 'Failed to delete member');
      }
      setIsDeleteDialogOpen(false);
      router.push('/dashboard/members');
      return data;
    };

    toast.promise(deletePromise(), {
      loading: 'Deleting member and invalidating passes...',
      success: `${member?.name || 'Member'} deleted successfully.`,
      error: (err: any) => {
        setIsDeleting(false);
        return `Error deleting member: ${err.message || 'Unknown error'}`;
      },
    });
  };

  if (loading) {
    return (
      <div className="min-h-full pb-12 flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-brand-blue/30 border-t-brand-blue rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-full pb-12 flex flex-col items-center justify-center py-20 space-y-4">
        <Alert variant="error" className="max-w-md">{error}</Alert>
        <Link href="/dashboard/members">
          <Button variant="outline">Back to Members</Button>
        </Link>
      </div>
    );
  }

  return (
    <PageShell>
      <Link href="/dashboard/members" className="inline-flex items-center gap-2 text-sm text-ink-secondary hover:text-ink-dark transition-colors font-medium">
        <ArrowLeft className="w-4 h-4" /> Back to Members
      </Link>

      <Card className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-ink-dark tracking-tight">{member.name || 'Unknown Member'}</h1>
            <p className="text-ink-secondary font-mono text-sm mt-1 flex items-center gap-2">
              {member.phone}
              {member.Tenant?.name && (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-surface-bone text-ink-dark uppercase tracking-widest font-sans border border-border-subtle">
                  {member.Tenant.name}
                </span>
              )}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            {member.consentedAt && (
              <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-md border border-emerald-500/20">
                <ShieldCheck className="w-3.5 h-3.5" /> DPDP Consented
              </div>
            )}
            <Button variant="destructive" size="sm" onClick={handleDeleteClick} disabled={isDeleting} className="w-full">
              <Trash2 className="w-4 h-4 mr-2" /> {isDeleting ? 'Deleting...' : 'Delete Member'}
            </Button>
          </div>
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
            <Edit3 className="w-4 h-4 text-brand-blue" /> Adjust Balance
          </h2>
          <form onSubmit={handleAdjust} className="space-y-4">
            {member.passes.length > 1 && (
              <div className="space-y-1.5">
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
                  className="w-full bg-surface-card border border-border-subtle rounded-lg px-3 py-2 text-sm text-ink-dark focus:outline-none focus:border-brand-blue"
                >
                  {member.passes.map((p: any) => (
                    <option key={p.id} value={p.id}>{p.fullPassId} — {p.balance} pts</option>
                  ))}
                </select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>New Balance (pts)</Label>
                <Input type="number" min="0" value={newBalance} onChange={(e) => setNewBalance(e.target.value)} onWheel={(e) => e.currentTarget.blur()} required />
              </div>
              <div className="space-y-1.5">
                <Label>New Tier</Label>
                <Input type="text" value={newTier} onChange={(e) => setNewTier(e.target.value)} placeholder="e.g. Gold" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Admin Note (audit trail)</Label>
              <Input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Bonus for feedback survey" />
            </div>
            {adjustMsg && <Alert variant={adjustMsg.startsWith('Error') ? 'error' : 'success'}>{adjustMsg}</Alert>}
            <Button type="submit" disabled={isAdjusting || !newBalance} className="w-full">
              {isAdjusting ? 'Applying...' : 'Apply Adjustment'}
            </Button>
          </form>
        </Card>
      )}

      {member.auditLog?.length > 0 && (
        <Card className="p-6">
          <h2 className="text-base font-semibold text-ink-dark flex items-center gap-2 mb-4">
            <History className="w-4 h-4 text-brand-blue" /> Audit Trail
          </h2>
          <div className="space-y-1">
            {member.auditLog.map((entry: any) => {
              const prev = entry.previousValue || entry.details?.previousValue;
              const next = entry.newValue || entry.details?.newValue;
              const entryNote = entry.note || entry.details?.note;
              return (
                <div key={entry.id} className="flex items-start gap-3 py-3 border-b border-border-subtle/50 last:border-0">
                  <div className="w-2 h-2 rounded-full bg-brand-blue mt-2 shrink-0" />
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
            <ShieldCheck className="w-4 h-4 text-brand-blue" /> Consent Records
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

      {/* Confirmation Dialog for Member Deletion */}
      <ConfirmationDialog
        isOpen={isDeleteDialogOpen}
        onClose={handleCancelDelete}
        onConfirm={handleConfirmDelete}
        title="Delete Member"
        confirmText="Delete Member"
        cancelText="Cancel"
        variant="destructive"
        isLoading={isDeleting}
        description={
          <span>
            Are you sure you want to permanently delete{' '}
            <strong className="text-ink-dark font-semibold">{member.name || 'this member'}</strong>{' '}
            (<span className="font-mono">{member.phone}</span>)? This action cannot be undone.
          </span>
        }
      >
        <div className="bg-canvas/70 border border-border-subtle rounded-xl p-3.5 text-xs text-ink-secondary space-y-2 mt-2">
          <div className="flex justify-between items-center">
            <span className="text-ink-muted">Active Passes</span>
            <span className="font-medium text-ink-dark">{member.passes?.length ?? 0} pass{(member.passes?.length ?? 0) === 1 ? '' : 'es'}</span>
          </div>
          {member.passes?.[0] && (
            <div className="flex justify-between items-center">
              <span className="text-ink-muted">Loyalty Balance</span>
              <span className="font-medium text-ink-dark">
                {member.passes[0].balance} pts {member.passes[0].tier ? `• ${member.passes[0].tier}` : ''}
              </span>
            </div>
          )}
          {member.Tenant?.name && (
            <div className="flex justify-between items-center">
              <span className="text-ink-muted">Brand / Tenant</span>
              <span className="font-medium text-ink-dark uppercase tracking-wider text-[11px]">{member.Tenant.name}</span>
            </div>
          )}
          <p className="text-[11px] text-red-400/90 pt-2 border-t border-border-subtle/50 flex items-center gap-1.5">
            <span>⚠️</span>
            <span>All Google Wallet passes will be revoked, and all audit records will be purged.</span>
          </p>
        </div>
      </ConfirmationDialog>
    </PageShell>
  );
}
