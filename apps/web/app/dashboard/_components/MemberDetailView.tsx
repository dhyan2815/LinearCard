'use client';
import React from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  ShieldCheck,
  History,
  Receipt,
  CreditCard,
  Trash2,
  BellOff,
  FlaskConical,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import { PageShell } from '@/components/ui/PageShell';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Alert } from '@/components/ui/Alert';
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog';

const money = (minor?: number | null, currency?: string | null) =>
  minor == null
    ? '—'
    : `${currency || 'INR'} ${(Number(minor) / 100).toFixed(2)}`;

function Tile({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="rounded-xl border border-border-subtle bg-canvas p-3">
      <p className="text-[10px] font-bold text-ink-secondary uppercase tracking-widest">{label}</p>
      <p className="text-lg font-semibold text-ink-dark mt-1 leading-tight">{value}</p>
      {sub && <p className="text-[11px] text-ink-muted mt-0.5">{sub}</p>}
    </div>
  );
}

function SectionCard({
  icon: Icon,
  title,
  count,
  children,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  title: string;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <Card className="p-6">
      <h2 className="text-base font-semibold text-ink-dark flex items-center gap-2 mb-4">
        <Icon className="w-4 h-4 text-brand-blue" strokeWidth={1.75} /> {title}
        {count != null && <span className="text-ink-muted font-normal">({count})</span>}
      </h2>
      {children}
    </Card>
  );
}

/**
 * One member, everything we hold on them: profile, the programs they hold a
 * pass in, their order history, payments, admin adjustments and consent.
 * Shared by the program-scoped route and the legacy /dashboard/members one.
 */
export function MemberDetailView({ backHref }: { backHref: string }) {
  const params = useSearchParams();
  const router = useRouter();
  const memberId = useMemberId();

  const [member, setMember] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');

  const [selectedPassId, setSelectedPassId] = React.useState('');
  const [newBalance, setNewBalance] = React.useState('');
  const [newTier, setNewTier] = React.useState('');
  const [note, setNote] = React.useState('');
  const [isAdjusting, setIsAdjusting] = React.useState(false);
  const [adjustMsg, setAdjustMsg] = React.useState('');

  const [isDeleting, setIsDeleting] = React.useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = React.useState(params.get('revoke') === '1');

  const loadMember = React.useCallback(
    async (keepPassId?: string) => {
      try {
        const data = await apiClient(`/members/${memberId}`);
        if (!data.success) throw new Error(data.error || 'Failed to load member');
        setMember(data.member);
        const passes = data.member.passes || [];
        if (passes.length > 0) {
          const target = passes.find((p: any) => p.id === keepPassId) || passes[0];
          setSelectedPassId(target.id);
          setNewBalance(String(target.balance));
          setNewTier(target.tier || '');
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load member');
      } finally {
        setLoading(false);
      }
    },
    [memberId],
  );

  React.useEffect(() => {
    loadMember();
  }, [loadMember]);

  const handleAdjust = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPassId) return;
    setIsAdjusting(true);
    setAdjustMsg('');
    const run = async () => {
      try {
        const data = await apiClient(`/members/${memberId}/adjust-balance`, {
          method: 'POST',
          body: JSON.stringify({
            passId: selectedPassId,
            newBalance: parseInt(newBalance, 10),
            newTier,
            note,
          }),
        });
        if (!data.success) throw new Error(data.error || 'Failed to adjust balance');
        setAdjustMsg('Balance adjusted. Wallet pass will update shortly.');
        setNote('');
        await loadMember(selectedPassId);
        return data;
      } finally {
        setIsAdjusting(false);
      }
    };
    toast.promise(run(), {
      loading: 'Updating balance & syncing wallet pass…',
      success: 'Balance adjusted.',
      error: (err: any) => {
        setAdjustMsg(`Error: ${err.message}`);
        return `Error: ${err.message}`;
      },
    });
  };

  const handleDelete = () => {
    setIsDeleting(true);
    toast.promise(
      (async () => {
        const data = await apiClient(`/members/${memberId}`, { method: 'DELETE' });
        if (!data.success) throw new Error(data.error || 'Failed to delete member');
        setIsDeleteOpen(false);
        router.push(backHref);
        return data;
      })(),
      {
        loading: 'Deleting member and invalidating passes…',
        success: `${member?.name || 'Member'} deleted.`,
        error: (err: any) => {
          setIsDeleting(false);
          return `Error deleting member: ${err.message || 'Unknown error'}`;
        },
      },
    );
  };

  if (loading) {
    return (
      <PageShell>
        <div className="h-5 w-32 rounded bg-surface-hover animate-pulse" />
        <div className="h-40 rounded-xl border border-border-subtle bg-surface-card animate-pulse" />
        <div className="h-64 rounded-xl border border-border-subtle bg-surface-card animate-pulse" />
      </PageShell>
    );
  }

  if (error || !member) {
    return (
      <PageShell>
        <Alert variant="error">{error || 'Member not found'}</Alert>
        <Link href={backHref}>
          <Button variant="outline">Back to Members</Button>
        </Link>
      </PageShell>
    );
  }

  const passes: any[] = member.passes || [];
  const audit: any[] = member.auditLog || [];
  const orders = audit.filter((a) => a.action === 'order_transaction');
  const adminActions = audit.filter((a) => a.action !== 'order_transaction');
  const payments: any[] = member.payments || [];
  const totalBalance = passes.reduce((sum, p) => sum + (Number(p.balance) || 0), 0);

  return (
    <PageShell>
      <Link
        href={backHref}
        className="inline-flex items-center gap-2 text-sm text-ink-secondary hover:text-ink-dark transition-colors font-medium"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Members
      </Link>

      {/* Profile */}
      <Card className="p-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-12 h-12 shrink-0 rounded-full bg-brand-blue/10 border border-brand-blue/20 flex items-center justify-center text-base font-bold text-brand-blue">
              {(member.name || member.phone || '?').charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold text-ink-dark tracking-tight truncate">
                {member.name || 'Unknown Member'}
              </h1>
              <p className="text-ink-secondary font-mono text-sm mt-0.5">{member.phone}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {member.consentedAt && (
              <Badge tone="success">
                <ShieldCheck className="w-3.5 h-3.5" /> Consented
              </Badge>
            )}
            {member.isTestAccount && (
              <Badge tone="info">
                <FlaskConical className="w-3.5 h-3.5" /> Test account
              </Badge>
            )}
            {member.marketingOptOutAt && (
              <Badge tone="warning">
                <BellOff className="w-3.5 h-3.5" /> Opted out
              </Badge>
            )}
            <Button variant="destructive" size="sm" onClick={() => setIsDeleteOpen(true)} disabled={isDeleting}>
              <Trash2 className="w-4 h-4 mr-2" /> Delete
            </Button>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Tile
            label="Enrolled"
            value={member.createdAt ? new Date(member.createdAt).toLocaleDateString() : '—'}
          />
          <Tile label="Programs" value={passes.length} sub={passes.length === 1 ? '1 pass' : `${passes.length} passes`} />
          <Tile label="Total balance" value={`${totalBalance} pts`} />
          <Tile label="Orders" value={orders.length} sub={payments.length ? `${payments.length} payments` : undefined} />
        </div>
      </Card>

      {/* Programs / passes */}
      <SectionCard icon={CreditCard} title="Programs & passes" count={passes.length}>
        {passes.length === 0 ? (
          <p className="text-sm text-ink-muted">This member holds no passes.</p>
        ) : (
          <div className="space-y-2">
            {passes.map((p) => (
              <div
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border-subtle bg-canvas px-4 py-3"
              >
                <div className="min-w-0">
                  {p.Program?.id ? (
                    <Link
                      href={`/dashboard/programs/${p.Program.id}/overview`}
                      className="text-sm font-medium text-brand-blue hover:text-brand-blue-hover"
                    >
                      {p.Program.name}
                    </Link>
                  ) : (
                    <span className="text-sm font-medium text-ink-dark">Unassigned program</span>
                  )}
                  <p className="text-[11px] text-ink-muted font-mono truncate">{p.fullPassId || p.id}</p>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-ink-secondary">{p.tier || '—'}</span>
                  <span className="text-ink-dark font-medium">{p.balance ?? 0} pts</span>
                  {p.Program?.kind && (
                    <Badge tone="neutral" dot={false} className="capitalize">
                      {p.Program.kind}
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* Orders */}
      <SectionCard icon={Receipt} title="Orders" count={orders.length}>
        {orders.length === 0 ? (
          <p className="text-sm text-ink-muted">No scan transactions yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-ink-muted text-xs border-b border-border-subtle">
                  <th className="py-2 font-medium">When</th>
                  <th className="py-2 font-medium">Type</th>
                  <th className="py-2 font-medium">Order</th>
                  <th className="py-2 font-medium text-right">Amount</th>
                  <th className="py-2 font-medium text-right">Points</th>
                  <th className="py-2 font-medium text-right">Balance</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => {
                  const points = Number(o.pointsChanged) || 0;
                  return (
                    <tr key={o.id} className="border-b border-border-subtle/60">
                      <td className="py-2 text-ink-secondary whitespace-nowrap">
                        {new Date(o.createdAt).toLocaleString()}
                      </td>
                      <td className="py-2 text-ink-dark capitalize">
                        {(o.transactionType || 'order').replace(/_/g, ' ')}
                      </td>
                      <td className="py-2 text-ink-muted font-mono text-xs">{o.orderId || '—'}</td>
                      <td className="py-2 text-ink-secondary text-right">
                        {o.orderAmount != null ? o.orderAmount : '—'}
                      </td>
                      <td
                        className={`py-2 text-right font-medium ${
                          points > 0 ? 'text-emerald-500' : points < 0 ? 'text-red-500' : 'text-ink-secondary'
                        }`}
                      >
                        {points > 0 ? `+${points}` : points || '—'}
                      </td>
                      <td className="py-2 text-ink-dark text-right">{o.newBalance ?? '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {/* Payments */}
      {payments.length > 0 && (
        <SectionCard icon={Receipt} title="Payments" count={payments.length}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-ink-muted text-xs border-b border-border-subtle">
                  <th className="py-2 font-medium">When</th>
                  <th className="py-2 font-medium">Provider</th>
                  <th className="py-2 font-medium">Reference</th>
                  <th className="py-2 font-medium text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className="border-b border-border-subtle/60">
                    <td className="py-2 text-ink-secondary whitespace-nowrap">
                      {p.occurredAt ? new Date(p.occurredAt).toLocaleString() : '—'}
                    </td>
                    <td className="py-2 text-ink-dark capitalize">{p.provider || '—'}</td>
                    <td className="py-2 text-ink-muted font-mono text-xs">{p.merchantRef || '—'}</td>
                    <td className="py-2 text-ink-dark text-right">{money(p.amountMinor, p.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}

      {/* Adjust balance */}
      {passes.length > 0 && (
        <SectionCard icon={Sparkles} title="Adjust balance">
          <form onSubmit={handleAdjust} className="space-y-4">
            {passes.length > 1 && (
              <div className="space-y-1.5">
                <Label>Pass</Label>
                <select
                  value={selectedPassId}
                  onChange={(e) => {
                    setSelectedPassId(e.target.value);
                    const p = passes.find((x) => x.id === e.target.value);
                    if (p) {
                      setNewBalance(String(p.balance));
                      setNewTier(p.tier || '');
                    }
                  }}
                  className="w-full bg-surface-card border border-border-subtle rounded-lg px-3 py-2 text-sm text-ink-dark focus:outline-none focus:border-brand-blue"
                >
                  {passes.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.Program?.name || p.fullPassId} — {p.balance} pts
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>New balance (pts)</Label>
                <Input
                  type="number"
                  min="0"
                  value={newBalance}
                  onChange={(e) => setNewBalance(e.target.value)}
                  onWheel={(e) => e.currentTarget.blur()}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label>New tier</Label>
                <Input
                  type="text"
                  value={newTier}
                  onChange={(e) => setNewTier(e.target.value)}
                  placeholder="e.g. Gold"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Admin note (audit trail)</Label>
              <Input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. Bonus for feedback survey"
              />
            </div>
            {adjustMsg && (
              <Alert variant={adjustMsg.startsWith('Error') ? 'error' : 'success'}>{adjustMsg}</Alert>
            )}
            <Button type="submit" disabled={isAdjusting || !newBalance}>
              {isAdjusting ? 'Applying…' : 'Apply adjustment'}
            </Button>
          </form>
        </SectionCard>
      )}

      {/* Member events */}
      {adminActions.length > 0 && (
        <SectionCard icon={History} title="Member Events" count={adminActions.length}>
          <div className="space-y-1">
            {adminActions.map((entry) => {
              const prev = entry.previousValue;
              const next = entry.newValue;
              return (
                <div
                  key={entry.id}
                  className="flex items-start gap-3 py-3 border-b border-border-subtle/50 last:border-0"
                >
                  <div className="w-2 h-2 rounded-full bg-brand-blue mt-2 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-ink-dark capitalize">
                      {entry.action.replace(/_/g, ' ')}
                    </p>
                    {prev && next && (
                      <p className="text-xs text-ink-secondary">
                        {prev.balance} → {next.balance} pts
                        {prev.tier !== next.tier ? ` • ${prev.tier} → ${next.tier}` : ''}
                      </p>
                    )}
                    {entry.note && <p className="text-xs text-ink-muted italic">{entry.note}</p>}
                    <p className="text-xs text-ink-muted mt-0.5">
                      {new Date(entry.createdAt).toLocaleString()}
                      {entry.actor ? ` · ${entry.actor}` : ''}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>
      )}

      {/* Consent */}
      {member.consentLog?.length > 0 && (
        <SectionCard icon={ShieldCheck} title="Consent records" count={member.consentLog.length}>
          <div className="space-y-2">
            {member.consentLog.map((entry: any) => (
              <div
                key={entry.id}
                className="text-sm text-ink-secondary py-2 border-b border-border-subtle/50 last:border-0"
              >
                <span className="text-emerald-500 font-medium">Consented</span> — {entry.legalTextVersion} •{' '}
                {new Date(entry.consentedAt).toLocaleString()}
                {entry.ipAddress && <span className="text-ink-muted ml-2 text-xs">from {entry.ipAddress}</span>}
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      <ConfirmationDialog
        isOpen={isDeleteOpen}
        onClose={() => !isDeleting && setIsDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Delete Member"
        confirmText="Delete Member"
        cancelText="Cancel"
        variant="destructive"
        isLoading={isDeleting}
        description={
          <span>
            Are you sure you want to permanently delete{' '}
            <strong className="text-ink-dark font-semibold">{member.name || 'this member'}</strong> (
            <span className="font-mono">{member.phone}</span>)? This action cannot be undone.
          </span>
        }
      >
        <div className="bg-canvas/70 border border-border-subtle rounded-xl p-3.5 text-xs text-ink-secondary space-y-2 mt-2">
          <div className="flex justify-between items-center">
            <span className="text-ink-muted">Active passes</span>
            <span className="font-medium text-ink-dark">{passes.length}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-ink-muted">Loyalty balance</span>
            <span className="font-medium text-ink-dark">{totalBalance} pts</span>
          </div>
          <p className="text-[11px] text-red-400/90 pt-2 border-t border-border-subtle/50">
            ⚠️ All Google Wallet passes will be revoked, and all audit records will be purged.
          </p>
        </div>
      </ConfirmationDialog>
    </PageShell>
  );
}

/** The route param is `id` on the legacy route and `memberId` under a program. */
function useMemberId() {
  const params = useParams<{ id?: string; memberId?: string }>();
  return params.memberId || params.id!;
}
