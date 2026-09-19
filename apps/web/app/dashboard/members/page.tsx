'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { DataTable, DataTableColumn } from '@/components/ui/DataTable';
import { PageShell } from '@/components/ui/PageShell';
import { PageHeader } from '@/components/ui/PageHeader';
import { Search } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { Tenant, Member } from '@linearcard/types';

export default function MembersPage() {
  const router = useRouter();
  const [members, setMembers] = useState<Member[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    // Fetch members
    apiClient('/members')
      .then(data => {
        if (data.success) {
          setMembers(data.members || []);
        } else {
          setError(data.error || 'Failed to load members');
        }
        setLoading(false);
      })
      .catch((err: any) => {
        setError(err.message || 'Failed to load members');
        setLoading(false);
      });

    // Fetch tenants
    apiClient('/tenant/tenants')
      .then(data => {
        if (data.success && data.tenants) {
          setTenants(data.tenants);
        }
      });
  }, []);

  const filteredMembers = members.filter(m => {
    const matchesSearch = m.phone?.includes(search) || (m.name && m.name.toLowerCase().includes(search.toLowerCase()));
    const matchesTenant = selectedTenantId === 'all' || m.tenantId === selectedTenantId;
    return matchesSearch && matchesTenant;
  });
  
  const flatMembers = filteredMembers.flatMap(member => {
    if (!member.passes || member.passes.length === 0) {
      return [{ ...member, pass: null }];
    }
    return member.passes.map((pass: any) => ({ ...member, pass }));
  });

  const columns: DataTableColumn<typeof flatMembers[number]>[] = [
    { header: 'Name', render: (item) => <span className="font-medium text-ink-dark">{item.name || '—'}</span> },
    { header: 'Phone Number', render: (item) => <span className="font-mono text-ink-secondary">{item.phone}</span> },
    {
      header: 'Pass ID',
      render: (item) =>
        item.pass ? (
          <span className="font-mono text-xs text-ink-secondary truncate max-w-30 inline-block" title={item.pass.id}>
            {item.pass.id}
          </span>
        ) : (
          <span className="font-mono text-xs text-ink-secondary italic">No Pass</span>
        ),
    },
    { header: 'Tier', render: (item) => <span className="text-ink-secondary">{item.pass ? item.pass.tier : '—'}</span> },
    { header: 'Balance', render: (item) => <span className="text-ink-secondary">{item.pass ? item.pass.balance : '—'}</span> },
  ];

  return (
    <PageShell>
      <PageHeader
        title="Members"
        description="View and search through all enrolled members."
        actions={
          <>
            <div className="flex flex-col items-start gap-1.5 w-full sm:w-auto">
              <Label>Filter Tenant</Label>
              <select
                value={selectedTenantId}
                onChange={(e) => setSelectedTenantId(e.target.value)}
                className="w-full sm:w-48 bg-surface-card border border-border-subtle rounded-lg px-3 py-2 text-sm text-ink-dark focus:outline-none focus:border-brand-blue"
              >
                <option value="all">All Brands</option>
                {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div className="flex flex-col items-start gap-1.5 w-full sm:w-auto">
              <Label>Search</Label>
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
                <Input
                  type="text"
                  placeholder="Search by name or phone..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </>
        }
      />

      <Card>
        <DataTable
          columns={columns}
          data={flatMembers}
          getRowKey={(item, idx) => `${item.id}-${item.pass?.id || idx}`}
          loading={loading}
          error={error}
          emptyMessage="No members found."
          onRowClick={(item) => router.push(`/dashboard/members/${item.id}`)}
        />
      </Card>
    </PageShell>
  );
}
