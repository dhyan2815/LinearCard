'use client';
import React from 'react';
import { useParams } from 'next/navigation';
import type { ProgramOverview } from '@linearcard/types';
import { apiClient } from '@/lib/api-client';
import { PageShell } from '@/components/ui/PageShell';
import { PageHeader } from '@/components/ui/PageHeader';

const RANGES = [
  { id: '7d', label: '7D', days: 7, groupBy: 'day' },
  { id: '30d', label: '30D', days: 30, groupBy: 'day' },
  { id: '90d', label: '90D', days: 90, groupBy: 'day' },
  { id: '12m', label: '12M', days: 365, groupBy: 'month' },
] as const;

const TILE = 'rounded-xl border border-border-subtle bg-surface-card p-4';

function Tile({ label, value }: { label: string; value: number }) {
  return (
    <div className={TILE}>
      <p className="text-xs text-ink-muted">{label}</p>
      <p className="text-2xl font-semibold text-ink-dark mt-1">{value}</p>
    </div>
  );
}

export default function ProgramOverviewPage() {
  const { id } = useParams<{ id: string }>();
  const [range, setRange] =
    React.useState<(typeof RANGES)[number]['id']>('30d');
  const [overview, setOverview] = React.useState<ProgramOverview | null>(null);

  React.useEffect(() => {
    const r = RANGES.find((x) => x.id === range)!;
    const from = new Date(Date.now() - r.days * 86400_000).toISOString();
    apiClient(
      `/programs/${id}/overview?from=${from}&groupBy=${r.groupBy}`,
    )
      .then((data) => data.success && setOverview(data.overview))
      .catch(() => setOverview(null));
  }, [id, range]);

  // A stacked bar needs a common scale; the tallest bucket sets it.
  const peak = Math.max(
    1,
    ...(overview?.series || []).map(
      (b) => b.created + b.installed + b.deleted,
    ),
  );

  return (
    <PageShell>
      <PageHeader
        title="Overview"
        description="Pass activity in this program."
        actions={
          <div className="flex items-center rounded-full border border-border-subtle p-1 text-sm">
            {RANGES.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setRange(r.id)}
                className={`px-3 py-1 rounded-full transition-colors ${
                  range === r.id
                    ? 'bg-brand-blue/10 text-brand-blue font-medium'
                    : 'text-ink-secondary hover:text-ink-dark'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Tile label="Active passes" value={overview?.active ?? 0} />
        <Tile label="Created" value={overview?.created ?? 0} />
        <Tile label="Installed" value={overview?.installed ?? 0} />
        <Tile label="Deleted" value={overview?.deleted ?? 0} />
      </div>

      <div className={`${TILE} mt-4`}>
        <p className="text-xs text-ink-muted mb-3">Installed by wallet</p>
        <div className="flex gap-8 text-sm">
          <div>
            <p className="text-ink-dark font-medium">
              {overview?.devices.google ?? 0}
            </p>
            <p className="text-xs text-ink-muted">Google Wallet</p>
          </div>
          <div>
            <p className="text-ink-muted font-medium">—</p>
            <p className="text-xs text-ink-muted">Apple · Not available yet</p>
          </div>
        </div>
      </div>

      <div className={`${TILE} mt-4`}>
        <div className="flex items-end gap-1 h-40">
          {(overview?.series || []).map((b) => (
            <div
              key={b.bucket}
              title={`${b.bucket} · ${b.created} created, ${b.installed} installed, ${b.deleted} deleted`}
              className="flex-1 flex flex-col justify-end gap-px min-w-[4px]"
            >
              <div
                className="bg-red-500/60 rounded-t-sm"
                style={{ height: `${(b.deleted / peak) * 100}%` }}
              />
              <div
                className="bg-brand-blue"
                style={{ height: `${(b.installed / peak) * 100}%` }}
              />
              <div
                className="bg-brand-blue/40"
                style={{ height: `${(b.created / peak) * 100}%` }}
              />
            </div>
          ))}
        </div>
        <p className="text-xs text-ink-muted mt-3">
          {overview?.historyStartsAt
            ? `Tracking since ${new Date(overview.historyStartsAt).toLocaleDateString()}`
            : 'No events recorded yet.'}
        </p>
      </div>
    </PageShell>
  );
}
