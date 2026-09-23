'use client';
import { useParams } from 'next/navigation';
import { MemberDetailView } from '../../../../_components/MemberDetailView';

export default function ProgramMemberDetailPage() {
  const { id } = useParams<{ id: string }>();
  return <MemberDetailView backHref={`/dashboard/programs/${id}/members`} />;
}
