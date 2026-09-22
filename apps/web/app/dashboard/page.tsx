'use client';
import React from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { PageShell } from '@/components/ui/PageShell';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { useDashboard } from './_components/DashboardContext';

/**
 * Phase 8 — the account landing page. Every program is a project with its own
 * overview, members, design and enrollment link; this is the way in.
 */
export default function ProjectGallery() {
  const { programs, currentTenant } = useDashboard();

  return (
    <PageShell>
      <PageHeader
        title="Projects"
        description="Each project is a program with its own members, tiers, design and enrollment link."
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {programs.map((p) => (
          <Link
            key={p.id}
            href={`/dashboard/programs/${p.id}/overview`}
            className="rounded-xl border border-border-subtle bg-surface-card p-4 hover:bg-surface-hover transition-colors"
          >
            <div className="flex items-start justify-between gap-2">
              <span className="text-sm font-medium text-ink-dark">
                {p.name}
              </span>
              <Badge tone={p.status === 'published' ? 'success' : 'warning'}>
                {p.status === 'published' ? 'Live' : 'Draft'}
              </Badge>
            </div>
            <p className="text-xs text-ink-muted mt-2 capitalize">{p.kind}</p>
          </Link>
        ))}

        <Link
          href="/dashboard/programs/new"
          className="rounded-xl border border-dashed border-border-subtle p-4 flex items-center justify-center gap-2 text-sm text-ink-secondary hover:text-ink-dark hover:bg-surface-hover transition-colors min-h-[104px]"
        >
          <Plus className="w-4 h-4" /> Create a new project
        </Link>
      </div>

      {programs.length === 0 && (
        <p className="text-sm text-ink-muted mt-4">
          {currentTenant?.name} has no projects yet. Start from a template.
        </p>
      )}
    </PageShell>
  );
}
