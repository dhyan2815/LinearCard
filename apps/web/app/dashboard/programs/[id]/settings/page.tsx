'use client';
import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import type { Program } from '@linearcard/types';
import { apiClient } from '@/lib/api-client';
import { useDashboard } from '../../../_components/DashboardContext';
import { PageShell } from '@/components/ui/PageShell';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog';

export default function ProgramSettingsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { refreshPrograms } = useDashboard();

  const [program, setProgram] = React.useState<Program | null>(null);
  const [form, setForm] = React.useState<Record<string, any>>({});
  const [saving, setSaving] = React.useState(false);

  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [confirmName, setConfirmName] = React.useState('');
  const [deleting, setDeleting] = React.useState(false);

  React.useEffect(() => {
    apiClient(`/programs/${id}`)
      .then((data) => {
        if (!data.success) return;
        const p: Program = data.program;
        setProgram(p);
        setForm({
          name: p.name ?? '',
          enrollmentSlug: p.enrollmentSlug ?? '',
          earnRate: p.earnRate ?? '',
          redeemRate: p.redeemRate ?? '',
          redeemCapPercent: p.redeemCapPercent ?? '',
          retentionDays: p.retentionDays ?? '',
          welcomeMessage: p.welcomeMessage ?? '',
        });
      })
      .catch(() => setProgram(null));
  }, [id]);

  const set = (key: string, value: any) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  // Loyalty economics only exist on a loyalty program; the API rejects them
  // on a ticket program, so the fields are not offered there either.
  const isLoyalty = program?.kind === 'loyalty';

  const save = async () => {
    if (saving) return;
    setSaving(true);
    const body: Record<string, any> = {
      name: form.name,
      enrollmentSlug: form.enrollmentSlug,
      welcomeMessage: form.welcomeMessage,
      retentionDays: form.retentionDays === '' ? null : Number(form.retentionDays),
    };
    if (isLoyalty) {
      for (const field of ['earnRate', 'redeemRate', 'redeemCapPercent'])
        if (form[field] !== '') body[field] = Number(form[field]);
    }

    const patch = async () => {
      const data = await apiClient(`/programs/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      if (!data.success) throw new Error(data.error || 'Failed to save');
      setProgram(data.program);
      await refreshPrograms();
      return data;
    };

    toast.promise(patch().finally(() => setSaving(false)), {
      loading: 'Saving...',
      success: 'Settings saved.',
      error: (err: any) => err.message || 'Failed to save',
    });
  };

  const remove = async () => {
    setDeleting(true);
    const del = async () => {
      const data = await apiClient(`/programs/${id}`, {
        method: 'DELETE',
        body: JSON.stringify({ confirmName }),
      });
      if (!data.success) throw new Error(data.error || 'Failed to delete');
      await refreshPrograms();
      router.push('/dashboard');
      return data;
    };

    toast.promise(del().finally(() => setDeleting(false)), {
      loading: 'Deleting project and expiring its passes...',
      success: 'Project deleted.',
      error: (err: any) => err.message || 'Failed to delete',
    });
  };

  return (
    <PageShell>
      <PageHeader
        title="Settings"
        description="Name, enrollment link, economics and retention for this project."
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            value={form.name ?? ''}
            onChange={(e) => set('name', e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="enrollmentSlug">Enrollment slug</Label>
          <Input
            id="enrollmentSlug"
            value={form.enrollmentSlug ?? ''}
            onChange={(e) => set('enrollmentSlug', e.target.value)}
          />
        </div>

        {isLoyalty && (
          <>
            <div className="space-y-2">
              <Label htmlFor="earnRate">Earn rate (points per unit)</Label>
              <Input
                id="earnRate"
                type="number"
                step="0.01"
                value={form.earnRate ?? ''}
                onChange={(e) => set('earnRate', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="redeemRate">Redeem rate (value per point)</Label>
              <Input
                id="redeemRate"
                type="number"
                step="0.01"
                value={form.redeemRate ?? ''}
                onChange={(e) => set('redeemRate', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="redeemCapPercent">Redemption cap (%)</Label>
              <Input
                id="redeemCapPercent"
                type="number"
                value={form.redeemCapPercent ?? ''}
                onChange={(e) => set('redeemCapPercent', e.target.value)}
              />
            </div>
          </>
        )}

        <div className="space-y-2">
          <Label htmlFor="retentionDays">Retention (days)</Label>
          <Input
            id="retentionDays"
            type="number"
            placeholder="Keep forever"
            value={form.retentionDays ?? ''}
            onChange={(e) => set('retentionDays', e.target.value)}
          />
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="welcomeMessage">Welcome message</Label>
          <Input
            id="welcomeMessage"
            placeholder="Sent over WhatsApp right after enrollment. Leave blank for none."
            value={form.welcomeMessage ?? ''}
            onChange={(e) => set('welcomeMessage', e.target.value)}
          />
        </div>
      </div>

      <div className="mt-6">
        <Button type="button" disabled={saving || !program} onClick={save}>
          Save changes
        </Button>
      </div>

      <div className="mt-12 rounded-xl border border-red-500/30 bg-surface-card p-4 max-w-2xl">
        <h2 className="text-sm font-semibold text-ink-dark">Danger zone</h2>
        <p className="text-xs text-ink-muted mt-1">
          Deleting this project removes its passes, tiers and templates, and
          expires every issued pass in Google Wallet. This cannot be undone.
        </p>
        <Button
          type="button"
          variant="outline"
          className="mt-3 text-red-500 border-red-500/30 hover:bg-red-500/10"
          onClick={() => {
            setConfirmName('');
            setConfirmOpen(true);
          }}
        >
          Delete this project
        </Button>
      </div>

      <ConfirmationDialog
        isOpen={confirmOpen}
        onClose={() => !deleting && setConfirmOpen(false)}
        onConfirm={remove}
        title={`Delete "${program?.name}"?`}
        description={
          <>
            Type{' '}
            <strong className="text-ink-dark font-medium">
              {program?.name}
            </strong>{' '}
            to confirm. Every issued pass will be expired in Google Wallet.
          </>
        }
        confirmText="Delete project"
        variant="destructive"
        isLoading={deleting}
        confirmDisabled={confirmName.trim() !== program?.name}
      >
        <Input
          autoFocus
          value={confirmName}
          placeholder={program?.name}
          onChange={(e) => setConfirmName(e.target.value)}
        />
      </ConfirmationDialog>
    </PageShell>
  );
}
