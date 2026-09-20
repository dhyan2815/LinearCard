'use client';
import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiClient, UnauthorizedError } from '@/lib/api-client';
import { useRouter } from 'next/navigation';
import { Tenant, DEFAULT_PASS_HEX } from '@linearcard/types';

type Archetype = 'loyalty' | 'membership' | 'id_card' | 'access_badge';

export interface DesignData {
  classSuffix: string;
  archetype: Archetype;
  cardTitle: string;
  hexBackgroundColor: string;
  logoUrl: string;
  heroImageUrl: string;
  rows: Array<{ id: string; columns: Array<{ key: string; header: string; body: string }> }>;
  tierThresholds: Array<{ name: string; min: number }>;
  storeLocations: Array<{ id?: string; latitude: string; longitude: string; label: string }>;
}

export interface StatsData {
  memberCount: number;
  passCount: number;
  walletStatus: { google: string; apple: string; samsung: string };
  tierDistribution: Record<string, number>;
}

export interface ManageData {
  passId: string;
  balance: string;
  tier: string;
  promoHeader: string;
  promoBody: string;
  phone: string;
  brandName: string;
}

interface DashboardContextType {
  tenants: Tenant[];
  currentTenant?: Tenant;
  selectedTenantId: string;
  handleTenantChange: (id: string) => void;
  
  designData: DesignData;
  setDesignData: React.Dispatch<React.SetStateAction<DesignData>>;
  
  savedTemplateId: string | null;
  setSavedTemplateId: React.Dispatch<React.SetStateAction<string | null>>;
  
  templateStatus: 'unsaved' | 'draft' | 'published';
  setTemplateStatus: React.Dispatch<React.SetStateAction<'unsaved' | 'draft' | 'published'>>;
  
  stats: StatsData;
  
  manageData: ManageData;
  setManageData: React.Dispatch<React.SetStateAction<ManageData>>;
  
  passHistory: any[];
  setPassHistory: React.Dispatch<React.SetStateAction<any[]>>;
  
  origin: string;
}

const DashboardContext = createContext<DashboardContextType | undefined>(undefined);

export function DashboardProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<string>('');
  const [origin, setOrigin] = useState<string>('');
  const [stats, setStats] = useState<StatsData>({
    memberCount: 0,
    passCount: 0,
    walletStatus: { google: 'loading', apple: 'not_configured', samsung: 'not_configured' },
    tierDistribution: {}
  });

  const [designData, setDesignData] = useState<DesignData>({
    classSuffix: '',
    archetype: 'loyalty',
    cardTitle: '',
    hexBackgroundColor: DEFAULT_PASS_HEX,
    logoUrl: '',
    heroImageUrl: '',
    rows: [
      { id: 'row1', columns: [{ key: 'points', header: 'Points', body: '500' }, { key: 'tier', header: 'Tier', body: 'Gold' }] }
    ],
    tierThresholds: [],
    storeLocations: []
  });

  const [savedTemplateId, setSavedTemplateId] = useState<string | null>(null);
  const [templateStatus, setTemplateStatus] = useState<'unsaved' | 'draft' | 'published'>('unsaved');
  const [manageData, setManageData] = useState<ManageData>({
    passId: '', balance: '', tier: '', promoHeader: '', promoBody: '', phone: '', brandName: ''
  });
  const [passHistory, setPassHistory] = useState<any[]>([]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setOrigin(window.location.origin);
    }

    let retryCount = 0;
    const maxRetries = 2;

    const fetchTenants = async () => {
      try {
        const data = await apiClient('/tenant/tenants');
        if (data.success && data.tenants && data.tenants.length > 0) {
          setTenants(data.tenants);
          setSelectedTenantId(data.tenants[0].id);
        }
      } catch (err) {
        // If 401, redirect to login (user not authenticated)
        if (err instanceof UnauthorizedError) {
          console.warn('Not authenticated. Redirecting to login.');
          router.push('/login');
          return;
        }

        // For network errors, retry with exponential backoff
        if (retryCount < maxRetries) {
          retryCount++;
          const delay = 1000 * Math.pow(2, retryCount - 1);
          setTimeout(fetchTenants, delay);
        } else {
          console.error('Failed to fetch tenants after retries:', err);
        }
      }
    };

    fetchTenants();
  }, [router]);

  const currentTenant = tenants.find(t => t.id === selectedTenantId);

  useEffect(() => {
    if (selectedTenantId) {
      apiClient(`/dashboard/stats?tenantId=${selectedTenantId}`)
        .then(data => {
           if (data.success) {
             setStats(data.stats);
           }
        })
        .catch(err => {
          if (err instanceof UnauthorizedError) {
            router.push('/login');
            return;
          }
          console.error('Failed to fetch stats:', err);
        });

      apiClient(`/members?tenantId=${selectedTenantId}`)
        .then(data => {
          if (data.success) {
             const allPasses = data.members?.flatMap((m: any) => m.passes?.map((p: any) => ({
                memberId: m.id,
                passData: { memberName: m.name || m.phone, ...p },
                passId: p.id,
                fullPassId: p.id,
                tenantName: m.Tenant?.name || 'Unknown Tenant'
             })) || []) || [];
             setPassHistory(allPasses);
          }
        })
        .catch(err => {
          if (err instanceof UnauthorizedError) {
            router.push('/login');
            return;
          }
          console.error('Failed to fetch members:', err);
        });
    }
  }, [selectedTenantId, router]);

  const handleTenantChange = (newTenantId: string) => {
    setSelectedTenantId(newTenantId);
    setManageData({ passId: '', balance: '', tier: '', promoHeader: '', promoBody: '', phone: '', brandName: '' });
    const t = tenants.find(tenant => tenant.id === newTenantId);
    setDesignData({
      classSuffix: t?.classSuffix || '',
      archetype: 'loyalty',
      cardTitle: t?.name || '',
      hexBackgroundColor: t?.brandHexColor || DEFAULT_PASS_HEX,
      logoUrl: t?.logoUrl || '',
      heroImageUrl: t?.heroUrl || '',
      rows: [
        { id: 'row1', columns: [{ key: 'points', header: 'Points', body: '500' }, { key: 'tier', header: 'Tier', body: 'Gold' }] }
      ],
      tierThresholds: [],
      storeLocations: []
    });
    setSavedTemplateId(null);
    setTemplateStatus('unsaved');
    setStats({
      memberCount: 0,
      passCount: 0,
      walletStatus: { google: 'loading', apple: 'not_configured', samsung: 'not_configured' },
      tierDistribution: {}
    });
    setPassHistory([]);
  };

  useEffect(() => {
    if (currentTenant) {
      apiClient(`/templates?tenantId=${currentTenant.id}`)
        .then(data => {
          if (data.success && data.templates && data.templates.length > 0) {
            const t = data.templates[0];
            setSavedTemplateId(t.id);
            setTemplateStatus(t.status || 'draft');
            setDesignData({
              classSuffix: t.classSuffix,
              archetype: t.archetype,
              cardTitle: t.title || t.name,
              hexBackgroundColor: t.hexBackgroundColor || DEFAULT_PASS_HEX,
              logoUrl: t.logoUrl || '',
              heroImageUrl: t.heroImageUrl || '',
              rows: (t.fieldRows || [{ id: 'row1', columns: [{ key: 'points', header: 'Points', body: '500' }, { key: 'tier', header: 'Tier', body: 'Gold' }] }]).map((row: any) => ({
                ...row,
                columns: row.columns.map((col: any, idx: number) => ({
                  ...col,
                  key: col.key || `${row.id}_${idx}`,
                })),
              })),
              tierThresholds: t.tierThresholds || [],
              storeLocations: t.storeLocations || []
            });
          } else {
            setSavedTemplateId(null);
            setTemplateStatus('unsaved');
            setDesignData({
              classSuffix: currentTenant.classSuffix || '',
              archetype: 'loyalty',
              cardTitle: currentTenant.name || '',
              hexBackgroundColor: currentTenant.brandHexColor || DEFAULT_PASS_HEX,
              logoUrl: currentTenant.logoUrl || '',
              heroImageUrl: currentTenant.heroUrl || '',
              rows: [
                { id: 'row1', columns: [{ key: 'points', header: 'Points', body: '500' }, { key: 'tier', header: 'Tier', body: 'Gold' }] }
              ],
              tierThresholds: [],
              storeLocations: []
            });
          }
        })
        .catch(err => {
          if (err instanceof UnauthorizedError) {
            router.push('/login');
            return;
          }
          console.error('Error fetching templates:', err);
          setSavedTemplateId(null);
          setTemplateStatus('unsaved');
        });
    }
  }, [currentTenant, router]);

  return (
    <DashboardContext.Provider value={{
      tenants,
      currentTenant,
      selectedTenantId,
      handleTenantChange,
      designData,
      setDesignData,
      savedTemplateId,
      setSavedTemplateId,
      templateStatus,
      setTemplateStatus,
      stats,
      manageData,
      setManageData,
      passHistory,
      setPassHistory,
      origin
    }}>
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboard() {
  const context = useContext(DashboardContext);
  if (context === undefined) {
    throw new Error('useDashboard must be used within a DashboardProvider');
  }
  return context;
}
