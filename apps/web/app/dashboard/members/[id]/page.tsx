'use client';
import { MemberDetailView } from '../../_components/MemberDetailView';

/** Legacy route — the program-scoped one is /dashboard/programs/[id]/members/[memberId]. */
export default function MemberDetailPage() {
  return <MemberDetailView backHref="/dashboard/members" />;
}
