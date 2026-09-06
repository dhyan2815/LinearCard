'use client';
import React, { useState, useEffect } from 'react';
import { Label } from '@/components/ui/Label';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';

export function SettingsView() {
  const router = useRouter();
  const [tenant, setTenant] = useState<any>(null);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isRotating, setIsRotating] = useState(false);
  const [msg, setMsg] = useState('');
  const [authError, setAuthError] = useState(false);

  useEffect(() => {
    fetch('/api/settings').then(async (r) => {
      if (r.status === 401) {
        setAuthError(true);
        router.push('/admin/login');
        return;
      }
      const d = await r.json();
      if (d.success) { setTenant(d.tenant); setWebhookUrl(d.tenant.webhookUrl || ''); }
    }).catch(err => console.error('Error fetching settings:', err));
  }, []);

  const handleSaveWebhook = async () => {
    setIsSaving(true); setMsg('');
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ webhookUrl }),
      });
      if (res.status === 401) { setAuthError(true); router.push('/admin/login'); return; }
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to save webhook URL');
      setMsg('Webhook URL saved.');
    } catch (err: any) { setMsg(`Error: ${err.message}`); }
    finally { setIsSaving(false); }
  };

  const handleRotateKey = async () => {
    if (!confirm('Rotate API key? The old key stops working immediately.')) return;
    setIsRotating(true);
    try {
      const res = await fetch('/api/admin/developer-settings', { method: 'POST' });
      if (res.status === 401) { setAuthError(true); router.push('/admin/login'); return; }
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to rotate key');
      setTenant((prev: any) => ({ ...prev, apiKey: data.apiKey }));
      setMsg('API key rotated.');
    } catch (err: any) { setMsg(`Error: ${err.message}`); }
    finally { setIsRotating(false); }
  };

  if (authError) return <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm">Session expired. Redirecting to login…</div>;
  if (!tenant) return <p className="text-ink-muted text-sm">Loading settings...</p>;

  return (
    <div className="max-w-2xl space-y-6">
      <div className="border-b border-border-subtle pb-4">
        <h2 className="text-xl font-medium text-ink-dark tracking-tight">Tenant Settings</h2>
        <p className="text-sm text-ink-secondary mt-1">Configure your API credentials and webhook integration endpoints.</p>
      </div>

      <Card className="p-6 space-y-4 bg-surface-card border-border-subtle shadow-sm">
        <h3 className="text-base font-semibold text-ink-dark">API Key</h3>
        <div className="flex items-center gap-2">
          <code className="flex-1 bg-surface-bone border border-border-subtle rounded-lg px-3 py-2 text-xs font-mono text-ink-secondary truncate">
            {tenant.apiKey || 'No key generated'}
          </code>
          <Button onClick={handleRotateKey} disabled={isRotating} variant="secondary" className="shrink-0">
            {isRotating ? 'Rotating...' : 'Rotate'}
          </Button>
        </div>
        <p className="text-xs text-ink-muted">Pass as <code>Authorization: Bearer &lt;key&gt;</code> for API calls.</p>
      </Card>

      <Card className="p-6 space-y-4 bg-surface-card border-border-subtle shadow-sm">
        <h3 className="text-base font-semibold text-ink-dark">Webhook URL</h3>
        <div className="space-y-1">
          <Label>Endpoint URL</Label>
          <Input type="url" value={webhookUrl} onChange={e => setWebhookUrl(e.target.value)}
            placeholder="https://your-server.com/webhook/linearcard" />
        </div>
        <p className="text-xs text-ink-muted">LinearCard will POST signed events here.</p>
        {msg && <p className={`text-sm font-medium ${msg.startsWith('Error') ? 'text-red-500' : 'text-emerald-400'}`}>{msg}</p>}
        <Button onClick={handleSaveWebhook} disabled={isSaving} className="w-full">
          {isSaving ? 'Saving...' : 'Save Webhook URL'}
        </Button>
      </Card>
    </div>
  );
}
