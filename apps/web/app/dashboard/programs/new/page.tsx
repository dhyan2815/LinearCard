'use client';
import React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import PassPreviewCard from '@/components/PassPreviewCard';
import { useDashboard } from '../../_components/DashboardContext';
import { PageShell } from '@/components/ui/PageShell';
import { PageHeader } from '@/components/ui/PageHeader';

interface Preset {
  id: string;
  name: string;
  kind: 'loyalty' | 'ticket';
  archetype: string;
  description: string;
  hexBackgroundColor: string;
  fieldRows: any[];
  tiers: Array<{ name: string; minPoints: number }>;
}

const CATEGORIES = ['All', 'Membership', 'Coupons', 'Event tickets'] as const;

/** Derived, not stored: the catalog has no category column of its own. */
function categoryOf(preset: Preset): string {
  if (preset.kind === 'ticket') return 'Event tickets';
  if (/coupon|offer|gift/.test(preset.id)) return 'Coupons';
  return 'Membership';
}

/**
 * Phase 8 — the template gallery. Creating a program always starts from a
 * preset, so there is never an empty program with no design to publish.
 */
export default function TemplateGallery() {
  const router = useRouter();
  const { refreshPrograms, handleProgramChange } = useDashboard();

  const [presets, setPresets] = React.useState<Preset[]>([]);
  const [category, setCategory] =
    React.useState<(typeof CATEGORIES)[number]>('All');
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    apiClient('/programs/presets')
      .then((data) => data.success && setPresets(data.presets))
      .catch(() => setPresets([]));
  }, []);

  const createProgram = async (presetId: string) => {
    if (busy) return;
    setBusy(true);
    const create = async () => {
      const data = await apiClient('/programs', {
        method: 'POST',
        body: JSON.stringify({ presetId }),
      });
      if (!data.success)
        throw new Error(data.error || 'Failed to create program');
      await refreshPrograms();
      handleProgramChange(data.program.id);
      router.push(`/dashboard/programs/${data.program.id}/design`);
      return data;
    };

    toast.promise(create().finally(() => setBusy(false)), {
      loading: 'Creating program...',
      success: 'Program created. Finish the design to publish it.',
      error: (err: any) => err.message || 'Failed to create program',
    });
  };

  const visible =
    category === 'All'
      ? presets
      : presets.filter((p) => categoryOf(p) === category);

  return (
    <PageShell>
      <PageHeader
        title="Create a program"
        description="Start from a template. Everything in it can be edited afterwards."
      />

      <div className="flex gap-2 flex-wrap mb-6">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCategory(c)}
            className={`px-3 py-1.5 rounded-full text-[13px] border transition-colors ${
              category === c
                ? 'border-brand-blue bg-brand-blue/10 text-brand-blue font-medium'
                : 'border-border-subtle text-ink-secondary hover:text-ink-dark hover:bg-surface-hover'
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {visible.map((preset) => (
          <button
            key={preset.id}
            type="button"
            disabled={busy}
            onClick={() => createProgram(preset.id)}
            className="text-left rounded-xl border border-border-subtle bg-surface-card p-4 hover:bg-surface-hover transition-colors disabled:opacity-60"
          >
            <div className="pointer-events-none mb-3">
              <PassPreviewCard
                cardTitle={preset.name}
                hexBackgroundColor={preset.hexBackgroundColor}
                rows={preset.fieldRows}
                archetype={preset.archetype}
              />
            </div>
            <span className="text-sm font-medium text-ink-dark">
              {preset.name}
            </span>
            <p className="text-xs text-ink-muted mt-1">{preset.description}</p>
          </button>
        ))}
      </div>

      {visible.length === 0 && (
        <p className="text-sm text-ink-muted mt-4">
          No templates in this category yet.
        </p>
      )}
    </PageShell>
  );
}
