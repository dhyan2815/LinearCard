'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import { Plus, Trash2 } from 'lucide-react';
import { PageShell } from '@/components/ui/PageShell';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import { useDashboard } from './_components/DashboardContext';
import { Program } from '@linearcard/types';

/**
 * Phase 8 — the account landing page. Every program has its own
 * overview, members, design and enrollment link; this is the way in.
 */
export default function ProgramGallery() {
  const { programs, programsLoaded, currentTenant, refreshPrograms } = useDashboard();
  
  const [programToDelete, setProgramToDelete] = useState<Program | null>(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!programToDelete) return;
    setIsDeleting(true);
    try {
      await apiClient(`/programs/${programToDelete.id}`, {
        method: 'DELETE',
        body: JSON.stringify({ confirmName: deleteConfirmName }),
      });
      toast.success(`Program "${programToDelete.name}" deleted.`);
      setProgramToDelete(null);
      setDeleteConfirmName('');
      await refreshPrograms();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete program');
    } finally {
      setIsDeleting(false);
    }
  };

  if (!programsLoaded) {
    return (
      <PageShell>
        <PageHeader
          title="Programs"
          description="Each program has its own members, tiers, design and enrollment link."
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="rounded-xl border border-border-subtle bg-surface-card p-4 min-h-26 animate-pulse"
            >
              <div className="h-4 w-1/2 rounded bg-surface-hover" />
              <div className="h-3 w-1/4 rounded bg-surface-hover mt-3" />
            </div>
          ))}
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHeader
        title="Programs"
        description="Each program has its own members, tiers, design and enrollment link."
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {programs.map((p) => (
          <div key={p.id} className="relative group">
            <Link
              href={`/dashboard/programs/${p.id}/overview`}
              className="flex flex-col justify-between rounded-xl border border-border-subtle bg-surface-card p-4 hover:bg-surface-hover transition-colors min-h-27.5"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-sm font-medium text-ink-dark pr-6">
                  {p.name}
                </span>
                <Badge tone={p.status === 'published' ? 'success' : 'warning'}>
                  {p.status === 'published' ? 'Live' : 'Draft'}
                </Badge>
              </div>
              <div className="flex items-center justify-between mt-4">
                <p className="text-xs text-ink-muted capitalize">{p.kind}</p>
                {/* Spacer to ensure the text doesn't flow under the absolute delete button */}
                <div className="w-8" />
              </div>
            </Link>
            
            <button
              onClick={(e) => {
                e.preventDefault();
                setProgramToDelete(p);
                setDeleteConfirmName('');
              }}
              className="absolute bottom-4 right-4 p-2 rounded-lg text-ink-muted hover:text-red-500 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all focus:opacity-100"
              aria-label="Delete program"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}

        <Link
          href="/dashboard/programs/new"
          className="rounded-xl border border-dashed border-border-subtle p-4 flex items-center justify-center gap-2 text-sm text-ink-secondary hover:text-ink-dark hover:bg-surface-hover transition-colors min-h-26"
        >
          <Plus className="w-4 h-4" /> Create a new program
        </Link>
      </div>

      {programs.length === 0 && (
        <p className="text-sm text-ink-muted mt-4">
          {currentTenant?.name} has no programs yet. Start from a template.
        </p>
      )}

      <ConfirmationDialog
        isOpen={!!programToDelete}
        onClose={() => {
          setProgramToDelete(null);
          setDeleteConfirmName('');
        }}
        onConfirm={handleDelete}
        title="Delete Program"
        description={
          <div className="space-y-4">
            <p className="text-sm text-ink-secondary">
              This action will permanently delete <strong>{programToDelete?.name}</strong>, along with all of its associated passes, tiers, templates, and analytics. This cannot be undone.
            </p>
            <div className="space-y-2">
              <Label>
                Type <strong>{programToDelete?.name}</strong> to confirm
              </Label>
              <Input
                value={deleteConfirmName}
                onChange={(e) => setDeleteConfirmName(e.target.value)}
                placeholder={programToDelete?.name || ''}
              />
            </div>
          </div>
        }
        confirmText="Delete Program"
        variant="destructive"
        isLoading={isDeleting}
        confirmDisabled={deleteConfirmName !== programToDelete?.name}
      />
    </PageShell>
  );
}
