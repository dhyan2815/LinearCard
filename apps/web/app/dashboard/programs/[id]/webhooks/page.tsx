'use client';
import React from 'react';
import { useParams } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { PageShell } from '@/components/ui/PageShell';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { SecretReveal } from '@/components/ui/SecretReveal';
import { DataTable, DataTableColumn } from '@/components/ui/DataTable';

const WEBHOOK_EVENTS = [
  'pass.installed',
  'pass.deleted',
  'points.awarded',
  'points.redeemed',
  'tier.changed',
  'member.enrolled',
];

interface Webhook {
  id: string;
  url: string;
  events: string[];
  active: boolean;
  createdAt: string;
}

/**
 * Phase 8 — endpoints that fire only for this program. Tenant-wide endpoints
 * live under Developers and fire for every program, including this one.
 */
export default function ProgramWebhooksPage() {
  const { id } = useParams<{ id: string }>();
  const [webhooks, setWebhooks] = React.useState<Webhook[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [newUrl, setNewUrl] = React.useState('');
  const [newEvents, setNewEvents] = React.useState<string[]>([]);
  const [creating, setCreating] = React.useState(false);
  const [revealedSecret, setRevealedSecret] = React.useState<string | null>(
    null,
  );

  const load = React.useCallback(() => {
    setLoading(true);
    apiClient(`/programs/${id}/webhooks`)
      .then((d) => setWebhooks(d.webhooks || []))
      .catch((err: any) => setError(err.message || 'Failed to load webhooks'))
      .finally(() => setLoading(false));
  }, [id]);

  React.useEffect(() => {
    load();
  }, [load]);

  const toggleEvent = (evt: string) =>
    setNewEvents((prev) =>
      prev.includes(evt) ? prev.filter((e) => e !== evt) : [...prev, evt],
    );

  const create = async () => {
    if (!newUrl || newEvents.length === 0) return;
    setCreating(true);
    try {
      const data = await apiClient(`/programs/${id}/webhooks`, {
        method: 'POST',
        body: JSON.stringify({ url: newUrl, events: newEvents }),
      });
      // The secret is shown once, on creation, and never stored client-side.
      setRevealedSecret(data.webhook.secret);
      setNewUrl('');
      setNewEvents([]);
      load();
    } catch (err: any) {
      setError(err.message || 'Failed to create webhook');
    } finally {
      setCreating(false);
    }
  };

  const remove = async (webhookId: string) => {
    if (!confirm('Delete this webhook endpoint?')) return;
    try {
      await apiClient(`/programs/${id}/webhooks/${webhookId}`, {
        method: 'DELETE',
      });
      load();
    } catch (err: any) {
      setError(err.message || 'Failed to delete webhook');
    }
  };

  const columns: DataTableColumn<Webhook>[] = [
    {
      header: 'URL',
      render: (h) => (
        <span className="font-mono text-xs text-ink-dark break-all">
          {h.url}
        </span>
      ),
    },
    {
      header: 'Events',
      render: (h) => (
        <span className="text-xs text-ink-secondary">{h.events.join(', ')}</span>
      ),
    },
    {
      header: '',
      align: 'right',
      render: (h) => (
        <Button variant="destructive" size="sm" onClick={() => remove(h.id)}>
          Delete
        </Button>
      ),
    },
  ];

  return (
    <PageShell>
      <PageHeader
        title="Webhooks"
        description="Endpoints that fire only for this project. Account-wide endpoints live under Developers."
      />

      <Card className="p-6 space-y-4">
        {revealedSecret ? (
          <SecretReveal
            label="Your new webhook signing secret"
            secret={revealedSecret}
            onDone={() => setRevealedSecret(null)}
          />
        ) : (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Endpoint URL</Label>
              <Input
                type="url"
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                placeholder="https://example.com/webhooks/linearcard"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Events</Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {WEBHOOK_EVENTS.map((evt) => (
                  <label
                    key={evt}
                    className="flex items-center gap-2 text-xs text-ink-secondary"
                  >
                    <input
                      type="checkbox"
                      checked={newEvents.includes(evt)}
                      onChange={() => toggleEvent(evt)}
                      className="rounded border-border-subtle"
                    />
                    {evt}
                  </label>
                ))}
              </div>
            </div>
            <Button
              onClick={create}
              disabled={creating || !newUrl || newEvents.length === 0}
              className="w-full sm:w-auto"
            >
              {creating ? 'Creating…' : 'Create endpoint'}
            </Button>
          </div>
        )}
        {error && <Alert variant="error">{error}</Alert>}
        <DataTable
          columns={columns}
          data={webhooks}
          getRowKey={(h) => h.id}
          loading={loading}
          emptyMessage="No webhook endpoints for this project."
        />
      </Card>
    </PageShell>
  );
}
