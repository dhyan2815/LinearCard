'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useDashboard } from '../_components/DashboardContext';

/** Phase 8 — this view moved under its program. Kept so old links still land. */
export default function LegacyTemplateDesignerRedirect() {
  const router = useRouter();
  const { selectedProgramId, programs } = useDashboard();
  useEffect(() => {
    const id = selectedProgramId || programs[0]?.id;
    router.replace(id ? `/dashboard/programs/${id}/design` : '/dashboard');
  }, [selectedProgramId, programs, router]);
  return null;
}
