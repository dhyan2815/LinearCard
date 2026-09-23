'use client';
import React from 'react';
import { useParams } from 'next/navigation';
import type { ProgramOverview } from '@linearcard/types';
import { apiClient } from '@/lib/api-client';
import { PageShell } from '@/components/ui/PageShell';
import { PageHeader } from '@/components/ui/PageHeader';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

function formatCurrency(value: number, currency = 'INR') {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-surface-card border border-border-subtle shadow-lg rounded-xl p-3 text-sm">
        <p className="font-semibold text-ink-dark mb-2">
          {new Date(label).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
        </p>
        <div className="space-y-1">
          {[...payload].reverse().map((entry: any, index: number) => (
            <div key={index} className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                <span className="text-ink-muted">{entry.name}</span>
              </div>
              <span className="text-ink-dark font-medium">
                {entry.name === 'Revenue' ? formatCurrency(entry.value) : entry.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

const RANGES = [
  { id: '7d', label: '7D', days: 7, groupBy: 'day' },
  { id: '30d', label: '30D', days: 30, groupBy: 'day' },
  { id: '90d', label: '90D', days: 90, groupBy: 'day' },
  { id: '12m', label: '12M', days: 365, groupBy: 'month' },
] as const;

const TILE = 'rounded-xl border border-border-subtle bg-surface-card p-4';

function Tile({ label, value }: { label: string; value: React.ReactNode }) {
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

  return (
    <PageShell>
      <PageHeader
        title="Overview"
        description="Business metrics and activity in this program."
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
        <Tile label="Revenue Generated" value={overview ? formatCurrency(overview.totalRevenue) : '-'} />
        <Tile label="Total Orders" value={overview?.totalOrders ?? '-'} />
        <Tile label="Points Awarded" value={overview ? `${overview.pointsAwarded} Pts` : '-'} />
        <Tile label="Points Redeemed" value={overview ? `${overview.pointsRedeemed} Pts` : '-'} />
      </div>

      <div className={`${TILE} mt-4 flex flex-col`}>
        <div className="h-64 w-full text-xs">
          {overview?.series?.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={overview.series}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-subtle, rgba(0,0,0,0.1))" />
                <XAxis
                  dataKey="bucket"
                  tickFormatter={(v) =>
                    new Date(v).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                    })
                  }
                  stroke="#888888"
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis stroke="#888888" tickLine={false} axisLine={false} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                <Bar dataKey="pointsRedeemed" name="Points Redeemed" stackId="a" fill="#c084fc" radius={[0, 0, 0, 0]} />
                <Bar dataKey="pointsAwarded" name="Points Awarded" stackId="a" fill="#34d399" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-ink-muted">
              No tracking data available for this time range.
            </div>
          )}
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
