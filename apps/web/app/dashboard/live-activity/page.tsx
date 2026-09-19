'use client';
import React, { useState } from 'react';
import { LiveActivityView } from '../_components/LiveActivityView';
import { useDashboard } from '../_components/DashboardContext';
import { apiClient } from '@/lib/api-client';
import { PageShell } from '@/components/ui/PageShell';
import { PageHeader } from '@/components/ui/PageHeader';

export default function LiveActivityPage() {
  const { 
    selectedTenantId, 
    manageData, 
    setManageData, 
    passHistory, 
    setPassHistory 
  } = useDashboard();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleUpdatePass = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError(null); setSuccessMsg(null);
    try {
      let msg = '';
      const shouldUpdateData = Boolean(manageData.balance || manageData.tier);
      const shouldSendPromo = Boolean(manageData.promoHeader || manageData.promoBody);
      
      if (!shouldUpdateData && !shouldSendPromo) {
        throw new Error('Please provide Tier/Balance to update, or Header/Body for a promo message.');
      }

      if (shouldSendPromo && (!manageData.promoHeader || !manageData.promoBody)) {
        throw new Error('Both Message Header and Body are required to send a promotional message.');
      }

      if (shouldUpdateData) {
        const data = await apiClient('/passes/update-pass', {
          method: 'POST', body: JSON.stringify({
            passId: manageData.passId,
            balance: manageData.balance,
            tier: manageData.tier
          })
        });
        if (!data.success && data.error !== 'Duplicate') throw new Error(data.error || 'Failed to update pass');
        msg += `Pass data updated. `;
        
        setPassHistory(prev => prev.map(p => {
          if (p.passId === manageData.passId || p.fullPassId === manageData.passId) {
            return { ...p, passData: { ...p.passData, balance: manageData.balance, tier: manageData.tier }};
          }
          return p;
        }));
      }

      if (shouldSendPromo) {
        const promoData = await apiClient('/passes/send-promo-message', {
          method: 'POST', body: JSON.stringify({
            passId: manageData.passId,
            header: manageData.promoHeader,
            body: manageData.promoBody
          })
        });
        if (!promoData.success) throw new Error(promoData.error || 'Failed to send promo message');
        msg += `Promotional message sent!`;
      }
      
      setSuccessMsg(msg.trim());
    } catch (err: any) { setError(err.message); } finally { setLoading(false); }
  };

  const selectPassForManage = (pass: any) => {
    setManageData(prev => ({
      ...prev,
      passId: pass.fullPassId || pass.passId,
      balance: pass.passData?.balance || '',
      tier: pass.passData?.tier || '',
      promoHeader: '',
      promoBody: ''
    }));
    setSuccessMsg(null); setError(null);
  };

  return (
    <PageShell>
      <PageHeader
        title="Live Updates"
        description="Select a pass from the current session to push instant patch updates over-the-air."
      />
      <LiveActivityView
        tenantId={selectedTenantId}
        manageData={manageData}
        setManageData={setManageData}
        handleUpdatePass={handleUpdatePass}
        loading={loading}
        error={error}
        successMsg={successMsg}
        passHistory={passHistory}
        selectPassForManage={selectPassForManage}
      />
    </PageShell>
  );
}
