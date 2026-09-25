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
  const [authError, setAuthError] = useState(false);

  useEffect(() => {
    apiClient('/settings').then(d => {
      if (d.success) { setTenant(d.tenant); }
    }).catch(err => {
      if (err.message.includes('Unauthorized')) {
        setAuthError(true);
        router.push('/login');
      } else {
        console.error('Error fetching settings:', err);
      }
    });
  }, []);

  if (authError) return <Alert variant="warning">Session expired. Redirecting to login…</Alert>;
  if (!tenant) return <p className="text-ink-muted text-sm">Loading settings...</p>;

  return (
    <div className="space-y-6">
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

      <Card className="p-6 space-y-3">
        <h3 className="text-base font-semibold text-ink-dark">Webhooks</h3>
        <p className="text-sm text-ink-secondary">
          Create and manage signed webhook endpoints from the Developers page.
        </p>
        <Link href="/dashboard/developers" className="block">
          <Button variant="secondary" className="w-full">Manage Webhooks →</Button>
        </Link>
      </Card>
    </div>
  );
}
