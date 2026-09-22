'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { slug: 'overview', label: 'Overview' },
  { slug: 'members', label: 'Members' },
  { slug: 'events', label: 'Member Events' },
  { slug: 'tiers', label: 'Tiers' },
  { slug: 'design', label: 'Design' },
  { slug: 'campaigns', label: 'Campaigns' },
  { slug: 'activity', label: 'Activity' },
  { slug: 'webhooks', label: 'Webhooks' },
  { slug: 'settings', label: 'Settings' },
] as const;

export function ProgramNav({ programId }: { programId: string }) {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 border-b border-border-subtle px-4 overflow-x-auto">
      {TABS.map((tab) => {
        const href = `/dashboard/programs/${programId}/${tab.slug}`;
        const isActive = pathname?.startsWith(href);
        return (
          <Link
            key={tab.slug}
            href={href}
            className={`px-3 py-2.5 text-[13px] whitespace-nowrap border-b-2 -mb-px transition-colors ${
              isActive
                ? 'border-brand-blue text-brand-blue font-medium'
                : 'border-transparent text-ink-secondary hover:text-ink-dark'
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
