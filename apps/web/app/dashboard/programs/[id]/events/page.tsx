'use client';
import React from 'react';
import { useParams } from 'next/navigation';
import type { ProgramMemberEvent } from '@linearcard/types';
import { apiClient } from '@/lib/api-client';
import { PageShell } from '@/components/ui/PageShell';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';

export default function ProgramEventsPage() {
  const { id } = useParams<{ id: string }>();
  const [events, setEvents] = React.useState<ProgramMemberEvent[]>([]);
  const [total, setTotal] = React.useState(0);
  const [offset, setOffset] = React.useState(0);
  const limit = 25;

  React.useEffect(() => {
    const params = new URLSearchParams({
      limit: String(limit),
      offset: String(offset),
    });
    apiClient(`/programs/${id}/events?${params}`)
      .then((data) => {
        if (!data.success) return;
        setEvents(data.events);
        setTotal(data.total);
      })
      .catch(() => setEvents([]));
  }, [id, offset]);

  return (
    <PageShell>
      <PageHeader
        title="Member Events"
        description="Everything that has happened to a pass in this program."
      />
      <table className="w-full text-sm mt-4">
        <thead>
          <tr className="text-left text-ink-muted text-xs border-b border-border-subtle">
            <th className="py-2 font-medium">Member</th>
            <th className="py-2 font-medium">Phone</th>
            <th className="py-2 font-medium">Event</th>
            <th className="py-2 font-medium">Occurred</th>
          </tr>
        </thead>
        <tbody>
          {events.map((e) => (
            <tr key={e.id} className="border-b border-border-subtle/60">
              <td className="py-2 text-ink-dark">{e.memberName || '—'}</td>
              <td className="py-2 text-ink-secondary">{e.phone || '—'}</td>
              <td className="py-2 text-ink-secondary">
                {e.action.replace(/_/g, ' ')}
              </td>
              <td className="py-2 text-ink-muted">
                {new Date(e.occurredAt).toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {events.length === 0 && (
        <p className="text-sm text-ink-muted mt-4">
          Events will appear here as passes are created and installed.
        </p>
      )}
      <div className="flex items-center gap-2 mt-4">
        <Button
          disabled={offset === 0}
          onClick={() => setOffset(Math.max(0, offset - limit))}
        >
          Previous
        </Button>
        <span className="text-xs text-ink-muted">
          {total === 0
            ? '0'
            : `${offset + 1}–${Math.min(offset + limit, total)} of ${total}`}
        </span>
        <Button
          disabled={offset + limit >= total}
          onClick={() => setOffset(offset + limit)}
        >
          Next
        </Button>
      </div>
    </PageShell>
  );
}
