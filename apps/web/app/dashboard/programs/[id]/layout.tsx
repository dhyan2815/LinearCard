import React from 'react';

/**
 * Phase 8 — the program header and nav live in the nested sidebar
 * (`ProgramSidebar`), so program pages use the shared dashboard shell
 * padding like every other route.
 */
export default function ProgramLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
