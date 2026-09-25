'use client';
import React from 'react';
import { useDashboard } from './DashboardContext';

export function DashboardHeaderBrand() {
  const { currentTenant } = useDashboard();
  
  if (!currentTenant) return null;
  
  return (
    <div className="text-[11px] font-medium text-ink-secondary tracking-wide leading-none mt-0.5">
      {currentTenant.name}
    </div>
  );
}
