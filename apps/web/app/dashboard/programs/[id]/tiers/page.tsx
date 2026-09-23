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

/**
 * Tiers used to be edited only inside the designer, so this tab rendered the
 * designer itself. It now owns the program's `Tier` rows directly — same
 * PATCH /programs/:id/tiers the designer used.
 */
export default function ProgramTiersPage() {
  const { id } = useParams<{ id: string }>();
  const { programs, tiers, setTiers } = useDashboard();
  const program = programs.find((p) => p.id === id);
  const [saving, setSaving] = React.useState(false);

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
      toast.success('Tiers saved');
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
      )}
    </PageShell>
  );
}
