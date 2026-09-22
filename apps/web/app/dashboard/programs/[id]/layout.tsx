'use client';
import React from 'react';
import { useParams } from 'next/navigation';
import { ProgramNav } from '../../_components/ProgramNav';
import { useDashboard } from '../../_components/DashboardContext';

export default function ProgramLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams<{ id: string }>();
  const { programs } = useDashboard();
  const program = programs.find((p) => p.id === params.id);

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-4">
        <h1 className="text-lg font-semibold text-ink-dark">
          {program?.name || 'Program'}
        </h1>
        <p className="text-xs text-ink-muted">
          {program?.status === 'published' ? 'Live' : 'Draft'}
          {program?.enrollmentSlug
            ? ` · /enroll/.../${program.enrollmentSlug}`
            : ''}
        </p>
      </div>
      <ProgramNav programId={params.id} />
      <div className="flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}
