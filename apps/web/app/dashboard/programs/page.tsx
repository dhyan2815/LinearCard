'use client';
import React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Check, Plus, Trash2 } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { useDashboard } from '../_components/DashboardContext';
import { PageShell } from '@/components/ui/PageShell';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog';

interface Preset {
  id: string;
  name: string;
  kind: 'loyalty' | 'ticket';
  description: string;
  hexBackgroundColor: string;
  tiers: Array<{ name: string; minPoints: number }>;
}

/**
 * Phase 3.4 — a tenant runs several programs (D8). This is the list, the
 * preset-driven create flow, and the switch that decides which program the
 * Template Designer edits.
 */
export default function ProgramsPage() {
  const router = useRouter();
  const {
    programs,
    selectedProgramId,
    handleProgramChange,
    refreshPrograms,
    currentTenant,
  } = useDashboard();

  const [presets, setPresets] = React.useState<Preset[]>([]);
  const [creatingPreset, setCreatingPreset] = React.useState<string | null>(null);
  const [newName, setNewName] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  const [programToDelete, setProgramToDelete] = React.useState<any | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);

  React.useEffect(() => {
    apiClient('/programs/presets')
      .then((data) => data.success && setPresets(data.presets))
      .catch(() => setPresets([]));
  }, []);

  const createProgram = async (presetId: string) => {
    setBusy(true);
    const create = async () => {
      const data = await apiClient('/programs', {
        method: 'POST',
        body: JSON.stringify({ presetId, name: newName || undefined }),
      });
      if (!data.success) throw new Error(data.error || 'Failed to create program');
      await refreshPrograms();
      handleProgramChange(data.program.id);
      setCreatingPreset(null);
      setNewName('');
      return data;
    };

    toast.promise(create().finally(() => setBusy(false)), {
      loading: 'Creating program...',
      success: 'Program created. Open the designer to publish it.',
      error: (err: any) => err.message || 'Failed to create program',
    });
  };

  const publish = async (id: string) => {
    toast.promise(
      apiClient(`/programs/${id}/publish`, { method: 'POST' }).then(
        async (data) => {
          if (!data.success) throw new Error(data.error || 'Publish failed');
          await refreshPrograms();
        },
      ),
      {
        loading: 'Publishing every tier class to Google Wallet...',
        success: 'Program published.',
        error: (err: any) => err.message || 'Publish failed',
      },
    );
  };

  const deleteProgram = async (program: any) => {
    setIsDeleting(true);
    const del = async () => {
      const data = await apiClient(`/programs/${program.id}`, {
        method: 'DELETE',
      });
      if (!data.success) throw new Error(data.error || 'Failed to delete program');
      await refreshPrograms();
      setProgramToDelete(null);
      return data;
    };

    toast.promise(del().finally(() => setIsDeleting(false)), {
      loading: 'Deleting program from database and Google Wallet...',
      success: `Program "${program.name}" deleted successfully.`,
      error: (err: any) => err.message || 'Failed to delete program',
    });
  };

  return (
    <PageShell>
      <PageHeader
        title="Programs"
        description="Each program has its own tiers, its own pass design and its own enrollment link."
      />

      <div className="space-y-3">
        {programs.length === 0 && (
          <p className="text-sm text-ink-muted">
            No programs yet. Pick a preset below to create your first one.
          </p>
        )}
        {programs.map((p: any) => {
          const enrollUrl =
            currentTenant?.classSuffix && p.enrollmentSlug
              ? `/enroll/${currentTenant.classSuffix}/${p.enrollmentSlug}`
              : null;
          return (
            <div
              key={p.id}
              className={`bg-surface-card rounded-xl border p-4 flex flex-col sm:flex-row sm:items-center gap-3 ${
                p.id === selectedProgramId
                  ? 'border-brand-blue'
                  : 'border-border-subtle'
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-ink-dark">{p.name}</span>
                  <Badge tone={p.status === 'published' ? 'success' : 'warning'}>
                    {p.status === 'published' ? 'Published' : 'Draft'}
                  </Badge>
                  <Badge tone="neutral">{p.kind}</Badge>
                </div>
                <p className="text-xs text-ink-muted mt-1 truncate">
                  {p.kind === 'loyalty'
                    ? `${p.tierCount ?? 0} tiers`
                    : 'Single-use, dated'}
                  {enrollUrl ? ` · ${enrollUrl}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {p.id === selectedProgramId ? (
                  <span className="text-xs font-semibold text-brand-blue flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" /> Active
                  </span>
                ) : (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => handleProgramChange(p.id)}
                  >
                    Select
                  </Button>
                )}
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    handleProgramChange(p.id);
                    router.push('/dashboard/template-designer');
                  }}
                >
                  Design
                </Button>
                <Button type="button" onClick={() => publish(p.id)}>
                  Publish
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="text-ink-muted hover:text-red-500 hover:border-red-500/30 hover:bg-red-500/10 cursor-pointer"
                  onClick={() => setProgramToDelete(p)}
                  title="Delete program"
                  aria-label="Delete program"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <h2 className="text-xs font-semibold text-ink-dark uppercase tracking-wide mt-8 mb-3">
        Create from a preset
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {presets.map((preset) => (
          <div
            key={preset.id}
            className="bg-surface-card rounded-xl border border-border-subtle p-4"
          >
            <div className="flex items-center gap-2 mb-1">
              <span
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: preset.hexBackgroundColor }}
              />
              <span className="text-sm font-semibold text-ink-dark">{preset.name}</span>
              <Badge tone="neutral">{preset.kind}</Badge>
            </div>
            <p className="text-xs text-ink-muted mb-3">{preset.description}</p>

            {creatingPreset === preset.id ? (
              <div className="flex items-center gap-2">
                <Input
                  autoFocus
                  value={newName}
                  placeholder={preset.name}
                  onChange={(e) => setNewName(e.target.value)}
                />
                <Button
                  type="button"
                  disabled={busy}
                  onClick={() => createProgram(preset.id)}
                >
                  Create
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setCreatingPreset(null)}
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setNewName('');
                  setCreatingPreset(preset.id);
                }}
              >
                <Plus className="w-3.5 h-3.5 mr-1" /> Use this preset
              </Button>
            )}
          </div>
        ))}
      </div>

      <ConfirmationDialog
        isOpen={Boolean(programToDelete)}
        onClose={() => !isDeleting && setProgramToDelete(null)}
        onConfirm={() => programToDelete && deleteProgram(programToDelete)}
        title={`Delete "${programToDelete?.name}"?`}
        description={
          <>
            Are you sure you want to delete <strong className="text-ink-dark font-medium">{programToDelete?.name}</strong>? This will permanently remove the program, its tier definitions, and templates from the database, and expire any issued passes in Google Wallet. This action cannot be undone.
          </>
        }
        confirmText="Delete Program"
        cancelText="Cancel"
        variant="destructive"
        isLoading={isDeleting}
      />
    </PageShell>
  );
}
