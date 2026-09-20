'use client';
import React from 'react';
import { SettingsView } from '../_components/SettingsView';
import { PageShell } from '@/components/ui/PageShell';
import { PageHeader } from '@/components/ui/PageHeader';

export default function SettingsPage() {
  return (
    <PageShell>
      <PageHeader
        title="Tenant Settings"
        description="Configure your API credentials and webhook integration endpoints."
      />
      <SettingsView />
    </PageShell>
  );
}
