'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  Users,
  ListChecks,
  Award,
  Palette,
  Megaphone,
  Zap,
  Webhook,
  Settings2,
  Copy,
  MapPin,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { toast } from 'sonner';
import { useDashboard } from './DashboardContext';

const ICON = 'w-4 h-4 shrink-0';

const TABS = [
  // ── Daily operations ──────────────────────────────
  { slug: 'overview',   label: 'Overview',   icon: LayoutDashboard },
  { slug: 'members',    label: 'Members',    icon: Users           },
  { slug: 'activity',   label: 'Activity',   icon: Zap             },
  { slug: 'campaigns',  label: 'Campaigns',  icon: Megaphone       },
  // ── Programme setup ───────────────────────────────
  { slug: 'design',     label: 'Design',     icon: Palette         },
  { slug: 'tiers',      label: 'Tiers',      icon: Award           },
  { slug: 'locations',  label: 'Locations',  icon: MapPin          },
  { slug: 'messages',   label: 'Messages',   icon: ListChecks      },
  // ── Developer / admin ─────────────────────────────
  { slug: 'webhooks',   label: 'Webhooks',   icon: Webhook         },
  { slug: 'settings',   label: 'Settings',   icon: Settings2       },
] as const;

/**
 * Phase 8 — the program's own nav. Lives as a second sidebar column nested
 * beside the account sidebar rather than a tab strip over the page, so the
 * content area keeps the same width and padding on every dashboard route.
 */
export function ProgramSidebar({ programId }: { programId: string }) {
  const pathname = usePathname();
  const { programs, currentTenant } = useDashboard();
  const program = programs.find((p) => p.id === programId);
  const [origin, setOrigin] = useState('');

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const enrollLink = origin && currentTenant && program
    ? `${origin}/enroll/${currentTenant.classSuffix}/${program.enrollmentSlug}`
    : '';

  return (
    <aside className="w-56 shrink-0 h-full flex flex-col border-r border-border-subtle bg-canvas overflow-y-auto">
      <div className="px-3 py-4 border-b border-border-subtle">
        <p className="text-[13px] font-semibold text-ink-dark truncate" title={program?.name}>
          {program?.name || 'Program'}
        </p>
        <p className="text-[11px] text-ink-muted truncate mt-0.5">
          {program?.status === 'published' ? 'Live' : 'Draft'}
          {program?.enrollmentSlug ? ` · /${program.enrollmentSlug}` : ''}
        </p>
      </div>

      <nav className="flex flex-col gap-0.5 p-2 flex-1">
        {TABS.map(({ slug, label, icon: Icon }) => {
          const href = `/dashboard/programs/${programId}/${slug}`;
          const isActive = pathname?.startsWith(href);
          return (
            <Link
              key={slug}
              href={href}
              className={`relative flex items-center gap-2.5 px-2 py-2 rounded-lg text-[13px] transition-colors ${isActive
                  ? 'bg-brand-blue/10 text-brand-blue font-medium'
                  : 'text-ink-secondary hover:bg-surface-hover hover:text-ink-dark'
                }`}
            >
              {isActive && (
                <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full bg-brand-blue" />
              )}
              <Icon className={ICON} strokeWidth={1.75} />
              <span className="truncate">{label}</span>
            </Link>
          );
        })}
      </nav>

      {enrollLink && (
        <div className="p-3 border-t border-border-subtle mt-auto">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-brand-blue mb-1.5">
            Enrollment Link
          </p>
          <div className="flex items-center justify-center mb-2">
            <div className="p-1.5 bg-white rounded-md shadow-sm">
              <QRCodeSVG value={enrollLink} size={72} level="Q" includeMargin={false} />
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(enrollLink);
              toast.success('Enrollment link copied to clipboard!');
            }}
            className="w-full flex items-center gap-1.5 text-[11px] px-2 py-1.5 rounded-md border border-border-subtle text-ink-secondary hover:bg-surface-hover hover:text-ink-dark transition-colors"
            title={enrollLink}
          >
            <Copy className="w-3 h-3 shrink-0" strokeWidth={1.75} />
            <span className="truncate">Copy Link</span>
          </button>
        </div>
      )}
    </aside>
  );
}
