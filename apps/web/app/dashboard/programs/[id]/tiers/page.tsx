'use client';
import React from 'react';
import { useParams } from 'next/navigation';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import { useDashboard } from '../../../_components/DashboardContext';
import { PageShell } from '@/components/ui/PageShell';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';

/**
 * Tiers used to be edited only inside the designer, so this tab rendered the
 * designer itself. It now owns the program's `Tier` rows directly — same
 * PATCH /programs/:id/tiers the designer used.
 */
export default function ProgramTiersPage() {
  const { id } = useParams<{ id: string }>();
  const { programs, tiers, setTiers, refreshPrograms } = useDashboard();
  const program = programs.find((p) => p.id === id);
  const [saving, setSaving] = React.useState(false);
  const [tierRules, setTierRules] = React.useState<{
    earnRate: number | string;
    redeemRate: number | string;
    redeemCapPercent: number | string;
  }>({
    earnRate: program?.earnRate ?? 0,
    redeemRate: program?.redeemRate ?? 0,
    redeemCapPercent: program?.redeemCapPercent ?? 0,
  });

  const isTicketProgram = program?.kind === 'ticket';

  const update = (index: number, field: 'name' | 'minPoints', value: string) => {
    setTiers((prev) => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        [field]: field === 'minPoints' ? Number(value) || 0 : value,
      };
      return next;
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      const named = tiers.filter((t) => t.name?.trim());
      await apiClient(`/programs/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          earnRate: Number(tierRules.earnRate) || 0,
          redeemRate: Number(tierRules.redeemRate) || 0,
          redeemCapPercent: Number(tierRules.redeemCapPercent) || 0,
        }),
      });
      const data = await apiClient(`/programs/${id}/tiers`, {
        method: 'PATCH',
        body: JSON.stringify({
          tiers: named.map((t) => ({
            name: t.name,
            minPoints: Number(t.minPoints) || 0,
            templateId: t.templateId ?? null,
          })),
        }),
      });
      if (!data.success) throw new Error(data.error || 'Error saving tiers');
      setTiers(data.tiers);
      await refreshPrograms();
      toast.success('Tier Rules and tiers saved');
    } catch (err: any) {
      toast.error(err.message || 'Error saving tiers');
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageShell>
      <PageHeader
        title="Tiers"
        description="Members are auto-promoted once their points balance reaches a tier's minimum, on every scan transaction."
        actions={
          !isTicketProgram && (
            <Button onClick={save} disabled={saving}>
              {saving ? 'Saving…' : 'Save tiers'}
            </Button>
          )
        }
      />

      {isTicketProgram ? (
        <p className="text-sm text-ink-muted">
          Tickets have no points and no tiers — they are single-use and dated.
        </p>
      ) : (
        <>
          <div className="rounded-xl border border-border-subtle bg-surface-card p-4 space-y-3">
            <div>
              <h3 className="text-xs font-semibold text-ink-dark uppercase tracking-wide mb-1">Tier Rules</h3>
              <p className="text-xs text-ink-muted mb-4">
                Applied on every scan. Earn rate is points per ₹1 spent; redeem
                rate is the ₹ discount each point buys; the cap limits how much of
                an order points may cover.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-semibold text-ink-secondary">Earn rate (pts per ₹1)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    max="10"
                    value={tierRules.earnRate}
                    onChange={(e) => setTierRules({ ...tierRules, earnRate: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-semibold text-ink-secondary">Redeem rate (₹ per pt)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max="1000"
                    value={tierRules.redeemRate}
                    onChange={(e) => setTierRules({ ...tierRules, redeemRate: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-semibold text-ink-secondary">Redeem cap (% of order)</Label>
                  <Input
                    type="number"
                    step="1"
                    min="0"
                    max="100"
                    value={tierRules.redeemCapPercent}
                    onChange={(e) => setTierRules({ ...tierRules, redeemCapPercent: e.target.value })}
                  />
                </div>
              </div>
              <p className="text-[11px] text-ink-muted mt-3">
                A ₹1,000 order earns {Math.floor(1000 * (Number(tierRules.earnRate) || 0))} pts, and points may
                cover at most ₹{Math.floor(1000 * ((Number(tierRules.redeemCapPercent) || 0) / 100))} of it.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border-subtle bg-surface-card p-4 space-y-2">
          {tiers.length === 0 && (
            <p className="text-sm text-ink-muted">
              No tiers yet. Add one to start promoting members.
            </p>
          )}

          {tiers.map((tier, idx) => (
            <div key={tier.id || idx} className="flex items-center gap-2">
              <Input
                value={tier.name}
                onChange={(e) => update(idx, 'name', e.target.value)}
                placeholder="Tier name (e.g. Gold)"
                className="flex-1"
              />
              <Input
                type="number"
                min={0}
                value={tier.minPoints}
                onChange={(e) => update(idx, 'minPoints', e.target.value)}
                placeholder="Min points"
                className="w-36"
              />
              <button
                type="button"
                onClick={() => setTiers((prev) => prev.filter((_, i) => i !== idx))}
                className="text-ink-muted hover:text-red-500 transition-colors px-2"
                aria-label="Remove tier"
              >
                ✕
              </button>
            </div>
          ))}

          <button
            type="button"
            onClick={() =>
              setTiers((prev) => [
                ...prev,
                { name: '', minPoints: 0, templateId: null } as any,
              ])
            }
            className="text-xs font-semibold text-brand-blue hover:text-brand-blue-hover transition-colors pt-1"
          >
            + Add tier
          </button>
          </div>
        </>
      )}
    </PageShell>
  );
}
