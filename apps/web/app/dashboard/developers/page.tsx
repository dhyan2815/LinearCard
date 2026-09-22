'use client';

import React, { useEffect, useState, useRef } from 'react';
import { PageShell } from '@/components/ui/PageShell';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Alert } from '@/components/ui/Alert';
import { DataTable, DataTableColumn } from '@/components/ui/DataTable';
import { SecretReveal } from '@/components/ui/SecretReveal';
import { apiClient } from '@/lib/api-client';
import { ChevronDown } from 'lucide-react';

const WEBHOOK_EVENTS = [
  'pass.installed',
  'pass.deleted',
  'points.awarded',
  'points.redeemed',
  'tier.changed',
  'member.enrolled',
];

interface ApiKey {
  id: string;
  name: string | null;
  prefix: string;
  lastUsedAt: string | null;
  createdAt: string;
  revokedAt: string | null;
}

interface Webhook {
  id: string;
  url: string;
  events: string[];
  active: boolean;
  createdAt: string;
}

interface PaymentConfig {
  path: string;
  secret: string;
}

interface SimulateResult {
  enrolled: boolean;
  pointsAwarded: number;
  newBalance: number;
  tier: string;
  tierChanged: boolean;
}

function fmtDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleString();
}

export default function DevelopersPage() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [keysLoading, setKeysLoading] = useState(true);
  const [keysError, setKeysError] = useState<string | null>(null);
  const [newKeyName, setNewKeyName] = useState('');
  const [creatingKey, setCreatingKey] = useState(false);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);

  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [webhooksLoading, setWebhooksLoading] = useState(true);
  const [webhooksError, setWebhooksError] = useState<string | null>(null);
  const [newUrl, setNewUrl] = useState('');
  const [newEvents, setNewEvents] = useState<string[]>([]);
  const [creatingWebhook, setCreatingWebhook] = useState(false);
  const [revealedSecret, setRevealedSecret] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testMsg, setTestMsg] = useState<string | null>(null);

  const [payConfig, setPayConfig] = useState<PaymentConfig | null>(null);
  const [simPhone, setSimPhone] = useState('');
  const [simAmount, setSimAmount] = useState('450');
  const [simulating, setSimulating] = useState(false);
  const [simResult, setSimResult] = useState<SimulateResult | null>(null);
  const [simError, setSimError] = useState<string | null>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [showMembers, setShowMembers] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const loadKeys = () => {
    setKeysLoading(true);
    apiClient('/developers/api-keys')
      .then((d) => setKeys(d.keys || []))
      .catch((err: any) => setKeysError(err.message || 'Failed to load API keys'))
      .finally(() => setKeysLoading(false));
  };

  const loadWebhooks = () => {
    setWebhooksLoading(true);
    apiClient('/developers/webhooks')
      .then((d) => setWebhooks(d.webhooks || []))
      .catch((err: any) => setWebhooksError(err.message || 'Failed to load webhooks'))
      .finally(() => setWebhooksLoading(false));
  };

  useEffect(() => {
    loadKeys();
    loadWebhooks();
    apiClient('/payments/webhook-config')
      .then((d) => setPayConfig({ path: d.path, secret: d.secret }))
      .catch(() => setPayConfig(null));
    apiClient('/members?limit=100')
      .then((d) => setMembers(d.members || []))
      .catch(() => setMembers([]));
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowMembers(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSimulate = async () => {
    setSimulating(true);
    setSimError(null);
    setSimResult(null);
    try {
      const data = await apiClient('/payments/simulate', {
        method: 'POST',
        body: JSON.stringify({ phone: simPhone, amount: Number(simAmount) }),
      });
      setSimResult(data);
    } catch (err: any) {
      setSimError(err.message || 'Simulated payment failed');
    } finally {
      setSimulating(false);
    }
  };

  const handleCreateKey = async () => {
    setCreatingKey(true);
    try {
      const data = await apiClient('/developers/api-keys', {
        method: 'POST',
        body: JSON.stringify({ name: newKeyName || undefined }),
      });
      setRevealedKey(data.key);
      setNewKeyName('');
      loadKeys();
    } catch (err: any) {
      setKeysError(err.message || 'Failed to create API key');
    } finally {
      setCreatingKey(false);
    }
  };

  const handleRevokeKey = async (id: string) => {
    if (!confirm('Revoke this API key? Requests using it will stop working immediately.')) return;
    try {
      await apiClient(`/developers/api-keys/${id}`, { method: 'DELETE' });
      loadKeys();
    } catch (err: any) {
      setKeysError(err.message || 'Failed to revoke key');
    }
  };

  const toggleEvent = (evt: string) => {
    setNewEvents((prev) => (prev.includes(evt) ? prev.filter((e) => e !== evt) : [...prev, evt]));
  };

  const handleCreateWebhook = async () => {
    if (!newUrl || newEvents.length === 0) return;
    setCreatingWebhook(true);
    try {
      const data = await apiClient('/developers/webhooks', {
        method: 'POST',
        body: JSON.stringify({ url: newUrl, events: newEvents }),
      });
      setRevealedSecret(data.webhook.secret);
      setNewUrl('');
      setNewEvents([]);
      loadWebhooks();
    } catch (err: any) {
      setWebhooksError(err.message || 'Failed to create webhook');
    } finally {
      setCreatingWebhook(false);
    }
  };

  const handleDeleteWebhook = async (id: string) => {
    if (!confirm('Delete this webhook endpoint?')) return;
    try {
      await apiClient(`/developers/webhooks/${id}`, { method: 'DELETE' });
      loadWebhooks();
    } catch (err: any) {
      setWebhooksError(err.message || 'Failed to delete webhook');
    }
  };

  const handleToggleActive = async (hook: Webhook) => {
    try {
      await apiClient(`/developers/webhooks/${hook.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ active: !hook.active }),
      });
      loadWebhooks();
    } catch (err: any) {
      setWebhooksError(err.message || 'Failed to update webhook');
    }
  };

  const handleTest = async (id: string) => {
    setTestingId(id);
    setTestMsg(null);
    try {
      const data = await apiClient(`/developers/webhooks/${id}/test`, { method: 'POST' });
      setTestMsg(data.message || 'Test event dispatched');
    } catch (err: any) {
      setTestMsg(err.message || 'Failed to send test event');
    } finally {
      setTestingId(null);
    }
  };

  const keyColumns: DataTableColumn<ApiKey>[] = [
    { header: 'Name', render: (k) => <span className="font-medium text-ink-dark">{k.name || 'Unnamed key'}</span> },
    { header: 'Prefix', render: (k) => <code className="font-mono text-xs text-ink-secondary">{k.prefix}…</code> },
    { header: 'Last Used', render: (k) => <span className="text-ink-secondary">{fmtDate(k.lastUsedAt)}</span> },
    { header: 'Created', render: (k) => <span className="text-ink-secondary">{fmtDate(k.createdAt)}</span> },
    {
      header: 'Status',
      render: (k) =>
        k.revokedAt ? (
          <span className="text-destructive text-xs font-semibold">Revoked</span>
        ) : (
          <span className="text-success text-xs font-semibold">Active</span>
        ),
    },
    {
      header: '',
      align: 'right',
      render: (k) =>
        !k.revokedAt && (
          <Button variant="destructive" size="sm" onClick={() => handleRevokeKey(k.id)}>
            Revoke
          </Button>
        ),
    },
  ];

  const webhookColumns: DataTableColumn<Webhook>[] = [
    { header: 'URL', render: (h) => <span className="font-mono text-xs text-ink-dark break-all">{h.url}</span> },
    {
      header: 'Events',
      render: (h) => <span className="text-xs text-ink-secondary">{h.events.join(', ')}</span>,
    },
    {
      header: 'Active',
      render: (h) => (
        <button
          onClick={() => handleToggleActive(h)}
          className={`text-xs font-semibold px-2 py-1 rounded-md ${h.active ? 'bg-success-surface text-success' : 'bg-surface-bone text-ink-muted'}`}
        >
          {h.active ? 'Active' : 'Paused'}
        </button>
      ),
    },
    {
      header: '',
      align: 'right',
      render: (h) => (
        <div className="flex items-center justify-end gap-2">
          <Button variant="secondary" size="sm" disabled={testingId === h.id} onClick={() => handleTest(h.id)}>
            {testingId === h.id ? 'Sending…' : 'Send test event'}
          </Button>
          <Button variant="destructive" size="sm" onClick={() => handleDeleteWebhook(h.id)}>
            Delete
          </Button>
        </div>
      ),
    },
  ];

  return (
    <PageShell>
      <PageHeader
        title="Developers"
        description="Manage API keys and webhook endpoints for programmatic access."
      />

      <Card className="p-6 space-y-4">
        <h3 className="text-base font-semibold text-ink-dark">API Keys</h3>
        {revealedKey ? (
          <SecretReveal label="Your new API key" secret={revealedKey} onDone={() => setRevealedKey(null)} />
        ) : (
          <div className="flex flex-col sm:flex-row items-end gap-3">
            <div className="space-y-1.5 flex-1 w-full">
              <Label>Key name (optional)</Label>
              <Input
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                placeholder="e.g. Production integration"
              />
            </div>
            <Button onClick={handleCreateKey} disabled={creatingKey} className="shrink-0">
              {creatingKey ? 'Creating…' : 'Create key'}
            </Button>
          </div>
        )}
        {keysError && <Alert variant="error">{keysError}</Alert>}
        <DataTable
          columns={keyColumns}
          data={keys}
          getRowKey={(k) => k.id}
          loading={keysLoading}
          emptyMessage="No API keys yet."
        />
      </Card>

      <Card className="p-6 space-y-4">
        <h3 className="text-base font-semibold text-ink-dark">Webhook Endpoints</h3>
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
                  <label key={evt} className="flex items-center gap-2 text-xs text-ink-secondary">
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
              onClick={handleCreateWebhook}
              disabled={creatingWebhook || !newUrl || newEvents.length === 0}
              className="w-full sm:w-auto"
            >
              {creatingWebhook ? 'Creating…' : 'Create endpoint'}
            </Button>
          </div>
        )}
        {webhooksError && <Alert variant="error">{webhooksError}</Alert>}
        {testMsg && <Alert variant="info">{testMsg}</Alert>}
        <DataTable
          columns={webhookColumns}
          data={webhooks}
          getRowKey={(h) => h.id}
          loading={webhooksLoading}
          emptyMessage="No webhook endpoints configured."
        />
      </Card>

      <Card className="p-6 space-y-4 overflow-visible">
        <div>
          <h3 className="text-base font-semibold text-ink-dark">Payment Simulator</h3>
          <p className="text-sm text-ink-secondary">
            Fires a correctly-signed payment webhook at your real endpoint. An unknown number is
            enrolled, issued a pass and awarded points in one step.
          </p>
        </div>

        {payConfig && (
          <div className="space-y-1.5">
            <Label>Endpoint</Label>
            <code className="block font-mono text-xs text-ink-secondary break-all">
              POST {payConfig.path}
            </code>
            <p className="text-xs text-ink-muted">
              Sign the raw JSON body with HMAC-SHA256 and send it as{' '}
              <code className="font-mono">X-LinearCard-Signature</code>. The body needs{' '}
              <code className="font-mono">phone</code>, <code className="font-mono">amountMinor</code>,{' '}
              <code className="font-mono">nonce</code> and <code className="font-mono">timestamp</code>.
            </p>
            <Label>Signing secret</Label>
            <code className="block bg-surface-bone border border-border-subtle rounded-lg px-3 py-2 text-xs font-mono text-ink-dark break-all">
              {payConfig.secret}
            </code>
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-end gap-3">
          <div className="space-y-1.5 flex-1 w-full relative" ref={containerRef}>
            <Label>Customer phone</Label>
            <div className="relative">
              <Input
                value={simPhone}
                onChange={(e) => setSimPhone(e.target.value)}
                placeholder="+919876543210"
                onFocus={() => setShowMembers(true)}
              />
              <ChevronDown className="absolute right-3 top-2.5 h-4 w-4 text-ink-muted pointer-events-none" />
            </div>
            
            {showMembers && members.length > 0 && (
              <div className="absolute z-10 top-full mt-1 w-full bg-surface border border-border-subtle rounded-md shadow-lg max-h-60 overflow-y-auto">
                <div className="text-[10px] uppercase font-semibold text-ink-muted px-3 py-2 bg-surface-bone sticky top-0">Select Member</div>
                {members.filter(m => !simPhone || m.phone.includes(simPhone) || m.name.toLowerCase().includes(simPhone.toLowerCase())).map((m) => (
                  <button
                    key={m.id}
                    onClick={() => {
                      setSimPhone(m.phone);
                      setShowMembers(false);
                    }}
                    className="w-full text-left px-3 py-2 text-xs text-ink-dark hover:bg-canvas/80 flex items-center justify-between transition-colors border-b border-border-subtle/50 last:border-0"
                  >
                    <span>
                      <span className="font-medium">{m.name || 'Unnamed'}</span>
                      {' '}
                      <small className="text-ink-secondary">({m.phone})</small>
                    </span>
                    <span className="font-semibold text-emerald-600">{m.passes?.[0]?.balance || 0} Pts</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="space-y-1.5 w-full sm:w-40">
            <Label>Amount (₹)</Label>
            <Input
              type="number"
              min="1"
              value={simAmount}
              onChange={(e) => setSimAmount(e.target.value)}
            />
          </div>
          <Button
            onClick={handleSimulate}
            disabled={simulating || !simPhone || !simAmount}
            className="shrink-0"
          >
            {simulating ? 'Sending…' : 'Simulate payment'}
          </Button>
        </div>

        {simError && <Alert variant="error">{simError}</Alert>}
        {simResult && (
          <Alert variant="info">
            {simResult.enrolled ? 'Enrolled a new member. ' : 'Awarded on the existing pass. '}
            {simResult.pointsAwarded} points added — new balance {simResult.newBalance} Pts, tier{' '}
            {simResult.tier}
            {simResult.tierChanged ? ' (tier changed)' : ''}.
          </Alert>
        )}
      </Card>

      <Card className="p-6">
        <h3 className="text-base font-semibold text-ink-dark mb-1">Delivery Log</h3>
        <p className="text-sm text-ink-secondary">
          Delivery history isn't exposed by the API yet — this is a placeholder until a delivery-log
          endpoint ships on the backend.
        </p>
      </Card>
    </PageShell>
  );
}
