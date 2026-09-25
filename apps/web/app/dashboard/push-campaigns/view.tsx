'use client';
import React from 'react';
import { PushCampaignsView } from '../_components/PushCampaignsView';
import { useDashboard } from '../_components/DashboardContext';
import { PageShell } from '@/components/ui/PageShell';
import { PageHeader } from '@/components/ui/PageHeader';

export default function PushCampaignsPage() {
  const { selectedTenantId } = useDashboard();

  return (
    <PageShell>
      <PageHeader
        title="Push Campaigns"
        description="Broadcast marketing updates or pass notifications across WhatsApp and Wallet Push."
      />
      <PushCampaignsView tenantId={selectedTenantId} />
    </PageShell>
  );
}
