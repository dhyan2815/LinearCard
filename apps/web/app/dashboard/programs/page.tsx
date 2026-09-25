import { redirect } from 'next/navigation';

/** Phase 8 — the project gallery is the dashboard landing page now. */
export default function ProgramsIndex() {
  redirect('/dashboard');
}
