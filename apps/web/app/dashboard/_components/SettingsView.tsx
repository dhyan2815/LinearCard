'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Label } from '@/components/ui/Label';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Alert } from '@/components/ui/Alert';
import { apiClient } from '@/lib/api-client';

export function SettingsView() {
  const router = useRouter();
  const [tenant, setTenant] = useState<any>(null);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [authError, setAuthError] = useState(false);

  useEffect(() => {
    apiClient('/settings').then(d => {
      if (d.success) { setTenant(d.tenant); setWebhookUrl(d.tenant.webhookUrl || ''); }
    }).catch(err => {
      if (err.message.includes('Unauthorized')) {
        setAuthError(true);
        router.push('/login');
      } else {
        console.error('Error fetching settings:', err);
      }
    });
  }, []);

  const handleSaveWebhook = async () => {
    setIsSaving(true); setMsg('');
    try {
      const data = await apiClient('/settings', {
        method: 'PATCH',
        body: JSON.stringify({ webhookUrl }),
      });
      if (!data.success) throw new Error(data.error || 'Failed to save webhook URL');
      setMsg('Webhook URL saved.');
    } catch (err: any) { 
      if (err.message.includes('Unauthorized')) { setAuthError(true); router.push('/login'); }
      else { setMsg(`Error: ${err.message}`); }
    }
    finally { setIsSaving(false); }
  };

  if (authError) return <Alert variant="warning">Session expired. Redirecting to login…</Alert>;
  if (!tenant) return <p className="text-ink-muted text-sm">Loading settings...</p>;

  return (
    <div className="space-y-6">
      <Card className="p-6 space-y-2">
        <h3 className="text-base font-semibold text-ink-dark">API Keys &amp; Webhooks</h3>
        <p className="text-sm text-ink-secondary">
          API key and webhook endpoint management has moved to the{' '}
          <Link href="/dashboard/developers" className="text-brand-blue font-medium hover:underline">
            Developers
          </Link>{' '}
          tab.
        </p>
      </Card>

      <Card className="p-6 space-y-2 opacity-60 pointer-events-none select-none">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-ink-dark">Apple Wallet</h3>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted bg-surface-bone px-2 py-1 rounded-md">
            Coming soon
          </span>
        </div>
        <p className="text-sm text-ink-secondary">
          Issue passes to Apple Wallet alongside Google Wallet. Not yet available.
        </p>
      </Card>

      <Card className="p-6 space-y-4">
        <h3 className="text-base font-semibold text-ink-dark">Webhook URL</h3>
        <div className="space-y-1.5">
          <Label>Endpoint URL</Label>
          <Input type="url" value={webhookUrl} onChange={e => setWebhookUrl(e.target.value)}
            placeholder="http://127.0.0.1:3001/passes/webhooks/external-order" />
        </div>
        <p className="text-xs text-ink-muted">LinearCard will POST signed events here.</p>
        {msg && <Alert variant={msg.startsWith('Error') ? 'error' : 'success'}>{msg}</Alert>}
        <Button onClick={handleSaveWebhook} disabled={isSaving} className="w-full">
          {isSaving ? 'Saving...' : 'Save Webhook URL'}
        </Button>
      </Card>
    </div>
  );
}
