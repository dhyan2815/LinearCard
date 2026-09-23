'use client';
import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiClient, UnauthorizedError } from '@/lib/api-client';
import { useRouter, usePathname } from 'next/navigation';
import { Tenant, Program, Tier, DEFAULT_PASS_HEX } from '@linearcard/types';

type Archetype = 'loyalty' | 'membership' | 'id_card' | 'access_badge';

export interface DesignData {
  classSuffix: string;
  archetype: Archetype;
  cardTitle: string;
  hexBackgroundColor: string;
  logoUrl: string;
  heroImageUrl: string;
  rows: Array<{ id: string; columns: Array<{ key: string; header: string; body: string }> }>;
  storeLocations: Array<{ id?: string; latitude: string; longitude: string; label: string }>;
  /** Loyalty economics (Phase 1.3) — interim home is the template row. */
  earnRate: number;
  redeemRate: number;
  redeemCapPercent: number;
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

  /** Phase 3.4 — a tenant runs several programs (D8); one is active at a time. */
  programs: Program[];
  /** False only once `/programs` has answered — the gallery must not flash
   * its empty state before the first response lands. */
  programsLoaded: boolean;
  currentProgram?: Program;
  selectedProgramId: string;
  handleProgramChange: (id: string) => void;
  refreshPrograms: () => Promise<void>;

  /**
   * Phase 3.2 — the active program's real `Tier` rows. This is the only tier
   * source of truth; the old `tierThresholds` JSONB on the template was
   * written by the designer and ignored by the runtime (DB-9).
   */
  tiers: Tier[];
  setTiers: React.Dispatch<React.SetStateAction<Tier[]>>;

  
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
    storeLocations: [],
    earnRate: 0.1,
    redeemRate: 1,
    redeemCapPercent: 50
  });

  const [programs, setPrograms] = useState<Program[]>([]);
  const [programsLoaded, setProgramsLoaded] = useState(false);
  const [selectedProgramId, setSelectedProgramId] = useState<string>('');
  const [tiers, setTiers] = useState<Tier[]>([]);
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
  const currentProgram = programs.find(p => p.id === selectedProgramId);

  // Phase 3.4 — programs belong to the selected tenant, and every
  // program-scoped view (designer, tiers) reads `selectedProgramId`.
  const loadPrograms = React.useCallback(async () => {
    if (!selectedTenantId) return;
    try {
      const data = await apiClient('/programs');
      if (data.success) {
        setPrograms(data.programs);
        // Phase 8 — under /dashboard/programs/[id] the URL owns the choice,
        // so never override it with the first program; elsewhere (gallery,
        // account pages) a sensible default is still wanted.
        setSelectedProgramId(prev =>
          data.programs.some((p: Program) => p.id === prev)
            ? prev
            : window.location.pathname.startsWith('/dashboard/programs/')
              ? prev
              : data.programs[0]?.id || ''
        );
      }
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        router.push('/login');
        return;
      }
      console.error('Failed to fetch programs:', err);
    } finally {
      setProgramsLoaded(true);
    }
  }, [selectedTenantId, router]);

  useEffect(() => {
    loadPrograms();
  }, [loadPrograms]);

  // Phase 8 — the URL owns the active program. Deep links must work, and two
  // tabs open on different programs must not fight over one piece of state.
  const pathname = usePathname();
  useEffect(() => {
    const match = pathname?.match(/^\/dashboard\/programs\/([^/]+)/);
    const idFromUrl = match?.[1];
    if (!idFromUrl || idFromUrl === 'new') return;
    if (idFromUrl !== selectedProgramId) {
      setSelectedProgramId(idFromUrl);
      setSavedTemplateId(null);
      setTemplateStatus('unsaved');
    }
  }, [pathname, selectedProgramId]);

  // The active program's tiers — loaded here so the designer's tier editor
  // and any future tier view share one copy.
  useEffect(() => {
    if (!selectedProgramId) {
      setTiers([]);
      return;
    }
    apiClient(`/programs/${selectedProgramId}/tiers`)
      .then(data => {
        if (data.success) setTiers(data.tiers);
      })
      .catch(err => {
        if (err instanceof UnauthorizedError) {
          router.push('/login');
          return;
        }
        console.error('Failed to fetch tiers:', err);
      });
  }, [selectedProgramId, router]);

  const handleProgramChange = (id: string) => {
    setSelectedProgramId(id);
    setSavedTemplateId(null);
    setTemplateStatus('unsaved');
  };

  useEffect(() => {
    if (selectedTenantId) {
      apiClient(`/dashboard/stats?tenantId=${selectedTenantId}`)
        .then(data => {
           if (data.success) {
             setStats({
               memberCount: data.memberCount ?? 0,
               passCount: data.passCount ?? 0,
               walletStatus: data.walletStatus,
               tierDistribution: data.tierDistribution ?? {},
             });
           }
        })
        .catch(err => {
          if (err instanceof UnauthorizedError) {
            router.push('/login');
            return;
          }
          console.error('Failed to fetch stats:', err);
        });
    }
  }, [selectedTenantId, router]);

  useEffect(() => {
    if (selectedTenantId) {
      // Phase 6.1 — this feeds the "select from history" picker, not a full
      // listing; the bound is explicit so it can't silently grow into one.
      const queryParams = new URLSearchParams({ tenantId: selectedTenantId, limit: '50' });
      if (selectedProgramId) queryParams.append('programId', selectedProgramId);
      
      apiClient(`/members?${queryParams.toString()}`)
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
  }, [selectedTenantId, selectedProgramId, router]);

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
      storeLocations: [],
      earnRate: 0.1,
      redeemRate: 1,
      redeemCapPercent: 50
    });
    setSavedTemplateId(null);
    setTemplateStatus('unsaved');
    setPrograms([]);
    setProgramsLoaded(false);
    setSelectedProgramId('');
    setTiers([]);
    setStats({
      memberCount: 0,
      passCount: 0,
      walletStatus: { google: 'loading', apple: 'not_configured', samsung: 'not_configured' },
      tierDistribution: {}
    });
    setPassHistory([]);
  };

  // Request-ordering guard: ensures a stale fetch response for a previous
  // program/tenant can never overwrite designData loaded for the current one.
  const templatesReqId = React.useRef(0);

  useEffect(() => {
    if (!currentTenant) return;
    const reqId = ++templatesReqId.current;
    apiClient(`/templates?tenantId=${currentTenant.id}`)
      .then(data => {
        if (reqId !== templatesReqId.current) return; // stale response — drop
        // PRG-2: pick the template of the *selected program*, not whichever
        // of the tenant's templates happens to sort first — under D8 that
        // would load the gym design while the coffee program is open.
        const scoped = (data.templates || []).filter((t: any) =>
          selectedProgramId ? t.programId === selectedProgramId : true
        );
        if (data.success && scoped.length > 0) {
          const t = scoped[0];
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
            storeLocations: programs.find(p => p.id === selectedProgramId)?.storeLocations || t.storeLocations || [],
            earnRate: t.earnRate ?? 0.1,
            redeemRate: t.redeemRate ?? 1,
            redeemCapPercent: t.redeemCapPercent ?? 50
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
            storeLocations: [],
            earnRate: 0.1,
            redeemRate: 1,
            redeemCapPercent: 50
          });
        }
      })
      .catch(err => {
        if (reqId !== templatesReqId.current) return; // stale response — drop
        if (err instanceof UnauthorizedError) {
          router.push('/login');
          return;
        }
        console.error('Error fetching templates:', err);
        setSavedTemplateId(null);
        setTemplateStatus('unsaved');
      });
  }, [currentTenant, selectedProgramId, router]);

  return (
    <DashboardContext.Provider value={{
      tenants,
      currentTenant,
      selectedTenantId,
      handleTenantChange,
      programs,
      programsLoaded,
      currentProgram,
      selectedProgramId,
      handleProgramChange,
      refreshPrograms: loadPrograms,
      tiers,
      setTiers,
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
