'use client';
import React from 'react';
import { useParams } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { PageShell } from '@/components/ui/PageShell';
import { PageHeader } from '@/components/ui/PageHeader';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

export default function ProgramMembersPage() {
  const { id } = useParams<{ id: string }>();
  const [members, setMembers] = React.useState<any[]>([]);
  const [total, setTotal] = React.useState(0);
  const [offset, setOffset] = React.useState(0);
  const [q, setQ] = React.useState('');
  const limit = 25;

  React.useEffect(() => {
    const params = new URLSearchParams({
      limit: String(limit),
      offset: String(offset),
    });
    if (q) params.set('q', q);
    apiClient(`/programs/${id}/members?${params}`)
      .then((data) => {
        if (!data.success) return;
        setMembers(data.members);
        setTotal(data.total);
      })
      .catch(() => setMembers([]));
  }, [id, offset, q]);

  return (
    <PageShell>
      <PageHeader
        title="Members"
        description="Everyone holding a live pass in this program."
      />
      <Input
        value={q}
        onChange={(e) => {
          setOffset(0);
          setQ(e.target.value);
        }}
        placeholder="Search name or phone"
        className="max-w-xs"
      />
      <table className="w-full text-sm mt-4">
        <thead>
          <tr className="text-left text-ink-muted text-xs border-b border-border-subtle">
            <th className="py-2 font-medium">Name</th>
            <th className="py-2 font-medium">Phone</th>
            <th className="py-2 font-medium">Tier</th>
            <th className="py-2 font-medium">Balance</th>
            <th className="py-2 font-medium">Joined</th>
          </tr>
        </thead>
        <tbody>
          {members.map((m) => {
            const pass = (m.passes || [])[0] || {};
            return (
              <tr key={m.id} className="border-b border-border-subtle/60">
                <td className="py-2 text-ink-dark">{m.name || '—'}</td>
                <td className="py-2 text-ink-secondary">{m.phone}</td>
                <td className="py-2 text-ink-secondary">{pass.tier || '—'}</td>
                <td className="py-2 text-ink-secondary">
                  {pass.balance ?? '—'}
                </td>
                <td className="py-2 text-ink-muted">
                  {m.createdAt
                    ? new Date(m.createdAt).toLocaleDateString()
                    : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {members.length === 0 && (
        <p className="text-sm text-ink-muted mt-4">
          No members in this program yet.
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
