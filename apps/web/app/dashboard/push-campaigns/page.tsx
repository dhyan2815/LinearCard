'use client';
import React from 'react';
import { PushCampaignsView } from '../_components/PushCampaignsView';
import { useDashboard } from '../_components/DashboardContext';

export default function PushCampaignsPage() {
  const { selectedTenantId } = useDashboard();

  return (
    <div className="min-h-full pb-12">
      <div className="max-w-[1600px] mx-auto">
        <PushCampaignsView tenantId={selectedTenantId} />
      </div>
    </div>
  );
}
