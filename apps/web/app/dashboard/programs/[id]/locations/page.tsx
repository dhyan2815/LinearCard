'use client';
import React from 'react';
import { useParams } from 'next/navigation';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import { useDashboard } from '../../../_components/DashboardContext';
import { PageShell } from '@/components/ui/PageShell';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { StoreLocationEntry } from '../../../_components/StoreLocationEntry';

export default function ProgramLocationsPage() {
  const { id } = useParams<{ id: string }>();
  const { programs, refreshPrograms } = useDashboard();
  const program = programs.find((p) => p.id === id);

  const [storeLocations, setStoreLocations] = React.useState<
    Array<{ id?: string; latitude: string; longitude: string; label: string }>
  >(program?.storeLocations || []);
  const [saving, setSaving] = React.useState(false);

  const [syncing, setSyncing] = React.useState(false);

  React.useEffect(() => {
    if (program?.storeLocations) {
      setStoreLocations(program.storeLocations);
    }
  }, [program?.storeLocations]);

  const addLocation = () => {
    if (storeLocations.length >= 10) return;
    setStoreLocations([
      ...storeLocations,
      { latitude: '', longitude: '', label: '' },
    ]);
  };

  const removeLocation = (idx: number) => {
    setStoreLocations((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateLocation = (
    index: number,
    fieldOrUpdates: 'latitude' | 'longitude' | 'label' | Record<string, string>,
    value?: string
  ) => {
    setStoreLocations((prev) => {
      const next = [...prev];
      if (typeof fieldOrUpdates === 'string') {
        next[index] = { ...next[index], [fieldOrUpdates]: value || '' };
      } else {
        next[index] = { ...next[index], ...fieldOrUpdates };
      }
      return next;
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      const data = await apiClient(`/programs/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ storeLocations }),
      });
      if (!data.success) throw new Error(data.error || 'Error saving locations');
      await refreshPrograms();
      toast.success('Store locations saved successfully!');
    } catch (err: any) {
      toast.error(err.message || 'Error saving locations');
    } finally {
      setSaving(false);
    }
  };

  const handleSyncFromWallet = async () => {
    setSyncing(true);
    try {
      const data = await apiClient(`/programs/${id}/sync-locations`, {
        method: 'POST',
      });
      if (!data.success) throw new Error(data.error || 'Error syncing locations');
      setStoreLocations(data.storeLocations || []);
      await refreshPrograms();
      toast.success('Successfully synced locations from Google Wallet API!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to sync locations from Google Wallet');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <PageShell>
      <PageHeader
        title="Store Locations"
        description="Add store locations for Google Wallet proximity notifications (~150m radius)."
        actions={
          <Button onClick={save} disabled={saving || syncing}>
            {saving ? 'Saving…' : 'Save locations'}
          </Button>
        }
      />

      <div className="rounded-xl border border-border-subtle bg-surface-card p-4 space-y-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold text-ink-dark">
            Store Locations ({storeLocations.length}/10 locations)
          </h3>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSyncFromWallet}
              disabled={syncing}
              className="text-xs font-semibold text-ink-secondary hover:text-ink-dark transition-colors disabled:opacity-50"
            >
              {syncing ? 'Syncing...' : 'Sync from Wallet API'}
            </button>
            <button
              type="button"
              onClick={addLocation}
              disabled={storeLocations.length >= 10 || syncing}
              className="text-xs font-semibold text-brand-blue hover:text-brand-blue-hover transition-colors disabled:opacity-50"
            >
              + Add Location
            </button>
          </div>
        </div>
        <p className="text-xs text-ink-muted mb-3">
          Up to 10 outlet pins for Google Wallet's proximity notifications (~150m
          radius). The notification text is Google's own and cannot be customised.
          Delivery requires the customer to have "Allow all the time" location
          access and the Nearby Passes toggle enabled — neither LinearCard nor the
          merchant can grant this on their behalf.
        </p>

        {storeLocations.length > 0 ? (
          <div className="space-y-4 mt-4">
            {storeLocations.map((loc, idx) => (
              <StoreLocationEntry
                key={idx}
                index={idx}
                location={loc}
                onUpdate={updateLocation}
                onRemove={removeLocation}
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-ink-muted mt-4">
            No locations added. Add one to enable proximity notifications.
          </p>
        )}
      </div>
    </PageShell>
  );
}
