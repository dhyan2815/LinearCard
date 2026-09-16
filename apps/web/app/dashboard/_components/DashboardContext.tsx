'use client';
import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import { Tenant } from '@linearcard/types';

type Archetype = 'loyalty' | 'membership' | 'id_card' | 'access_badge';

export interface DesignData {
  classSuffix: string;
  archetype: Archetype;
  cardTitle: string;
  hexBackgroundColor: string;
  logoUrl: string;
  heroImageUrl: string;
  rows: Array<{ id: string; columns: Array<{ header: string; body: string }> }>;
  linksModuleData: Array<{ id?: string; uri: string; description: string }>;
  imageModulesData: Array<{ id?: string; imageUrl: string; description?: string }>;
  textModulesData: Array<{ id?: string; header: string; body: string }>;
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
    hexBackgroundColor: '#1A365D',
    logoUrl: '',
    heroImageUrl: '',
    rows: [
      { id: 'row1', columns: [{ header: 'Points', body: '500' }, { header: 'Tier', body: 'Gold' }] }
    ],
    linksModuleData: [],
    imageModulesData: [],
    textModulesData: []
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
    apiClient('/tenant/tenants')
      .then(data => {
        if (data.success && data.tenants && data.tenants.length > 0) {
          setTenants(data.tenants);
          setSelectedTenantId(data.tenants[0].id);
        }
      })
      .catch(err => console.error('Failed to fetch tenants:', err));
  }, []);

  const currentTenant = tenants.find(t => t.id === selectedTenantId);

  useEffect(() => {
    if (selectedTenantId) {
      apiClient(`/dashboard/stats?tenantId=${selectedTenantId}`)
        .then(data => {
           if (data.success) {
             setStats(data.stats);
           }
        })
        .catch(err => console.error('Failed to fetch stats:', err));
        
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
        .catch(err => console.error('Failed to fetch members:', err));
    }
  }, [selectedTenantId]);

  const handleTenantChange = (newTenantId: string) => {
    setSelectedTenantId(newTenantId);
    setManageData({ passId: '', balance: '', tier: '', promoHeader: '', promoBody: '', phone: '', brandName: '' });
    const t = tenants.find(tenant => tenant.id === newTenantId);
    setDesignData({
      classSuffix: t?.classSuffix || '',
      archetype: 'loyalty',
      cardTitle: t?.name || '',
      hexBackgroundColor: t?.brandHexColor || '#1A365D',
      logoUrl: t?.logoUrl || '',
      heroImageUrl: t?.heroUrl || '',
      rows: [
        { id: 'row1', columns: [{ header: 'Points', body: '500' }, { header: 'Tier', body: 'Gold' }] }
      ],
      linksModuleData: [],
      imageModulesData: [],
      textModulesData: []
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
              hexBackgroundColor: t.hexBackgroundColor,
              logoUrl: t.logoUrl || '',
              heroImageUrl: t.heroImageUrl || '',
              rows: t.fieldRows || [{ id: 'row1', columns: [{ header: 'Points', body: '500' }, { header: 'Tier', body: 'Gold' }] }],
              linksModuleData: t.linksModuleData || [],
              imageModulesData: t.imageModulesData || [],
              textModulesData: t.textModulesData || []
            });
          } else {
            setSavedTemplateId(null);
            setTemplateStatus('unsaved');
            setDesignData({
              classSuffix: currentTenant.classSuffix || '',
              archetype: 'loyalty',
              cardTitle: currentTenant.name || '',
              hexBackgroundColor: currentTenant.brandHexColor || '#1A365D',
              logoUrl: currentTenant.logoUrl || '',
              heroImageUrl: currentTenant.heroUrl || '',
              rows: [
                { id: 'row1', columns: [{ header: 'Points', body: '500' }, { header: 'Tier', body: 'Gold' }] }
              ],
              linksModuleData: [],
              imageModulesData: [],
              textModulesData: []
            });
          }
        })
        .catch(err => {
          console.error('Error fetching templates:', err);
          setSavedTemplateId(null);
          setTemplateStatus('unsaved');
        });
    }
  }, [currentTenant]);

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
