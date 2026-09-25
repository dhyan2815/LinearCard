'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useDashboard } from './DashboardContext';

/**
 * Phase 8 — these views moved under their program. Kept so old links still
 * land. Waits for `/programs` to answer: redirecting before it does always
 * fell through to the gallery instead of the program-scoped view.
 */
export function LegacyProgramRedirect({ slug }: { slug: string }) {
  const router = useRouter();
  const { selectedProgramId, programs, programsLoaded } = useDashboard();
  useEffect(() => {
    if (!programsLoaded) return;
    const id = selectedProgramId || programs[0]?.id;
    router.replace(id ? `/dashboard/programs/${id}/${slug}` : '/dashboard');
  }, [selectedProgramId, programs, programsLoaded, slug, router]);
  return null;
}
