'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { DataTable, DataTableColumn } from '@/components/ui/DataTable';
import { PageShell } from '@/components/ui/PageShell';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Search, Copy, Check, Eye, Trash2, ArrowUpDown } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { Tenant, Member } from '@linearcard/types';
import { toast } from 'sonner';

const PAGE_SIZE = 20;

type SortKey = 'name' | 'balance';

export default function MembersPage() {
  const router = useRouter();
  const [members, setMembers] = useState<Member[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyPassId = (passId: string) => {
    navigator.clipboard.writeText(passId);
    setCopiedId(passId);
    toast.success('Pass ID copied');
    setTimeout(() => setCopiedId((cur) => (cur === passId ? null : cur)), 1500);
  };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
    setPage(1);
  };

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

  const sortedMembers = [...flatMembers].sort((a, b) => {
    const dir = sortDir === 'asc' ? 1 : -1;
    if (sortKey === 'balance') {
      return ((Number(a.pass?.balance) || 0) - (Number(b.pass?.balance) || 0)) * dir;
    }
    return (a.name || '').localeCompare(b.name || '') * dir;
  });

  const totalPages = Math.max(1, Math.ceil(sortedMembers.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedMembers = sortedMembers.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const SortHeader = ({ label, sortField }: { label: string; sortField: SortKey }) => (
    <button
      type="button"
      onClick={() => toggleSort(sortField)}
      className="flex items-center gap-1 hover:text-ink-dark transition-colors"
    >
      {label}
      <ArrowUpDown className={`w-3 h-3 ${sortKey === sortField ? 'text-brand-blue' : 'text-ink-muted'}`} strokeWidth={2} />
    </button>
  );

  const columns: DataTableColumn<typeof pagedMembers[number]>[] = [
    { header: <SortHeader label="Name" sortField="name" />, render: (item) => <span className="font-medium text-ink-dark">{item.name || '—'}</span> },
    { header: 'Phone Number', render: (item) => <span className="font-mono text-ink-secondary">{item.phone}</span> },
    {
      header: 'Pass ID',
      render: (item) =>
        item.pass ? (
          <span className="inline-flex items-center gap-1.5">
            <span className="font-mono text-xs text-ink-secondary truncate max-w-30 inline-block" title={item.pass.id}>
              {item.pass.id}
            </span>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); copyPassId(item.pass!.id); }}
              className="text-ink-muted hover:text-brand-blue transition-colors shrink-0"
              aria-label="Copy Pass ID"
            >
              {copiedId === item.pass.id ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </span>
        ) : (
          <span className="font-mono text-xs text-ink-secondary italic">No Pass</span>
        ),
    },
    { header: 'Tier', render: (item) => <span className="text-ink-secondary">{item.pass ? item.pass.tier : '—'}</span> },
    { header: <SortHeader label="Balance" sortField="balance" />, render: (item) => <span className="text-ink-secondary">{item.pass ? item.pass.balance : '—'}</span> },
    {
      header: 'Actions',
      align: 'right',
      render: (item) => (
        <span className="inline-flex items-center gap-1 justify-end">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); router.push(`/dashboard/members/${item.id}`); }}
            className="p-1.5 rounded-md text-ink-muted hover:text-brand-blue hover:bg-brand-blue/10 transition-colors"
            aria-label="View member"
            title="View detail"
          >
            <Eye className="w-4 h-4" strokeWidth={1.75} />
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); router.push(`/dashboard/members/${item.id}?revoke=1`); }}
            className="p-1.5 rounded-md text-ink-muted hover:text-red-500 hover:bg-red-500/10 transition-colors"
            aria-label="Revoke pass"
            title="Revoke pass"
          >
            <Trash2 className="w-4 h-4" strokeWidth={1.75} />
          </button>
        </span>
      ),
    },
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
                onChange={(e) => { setSelectedTenantId(e.target.value); setPage(1); }}
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
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
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
          data={pagedMembers}
          getRowKey={(item, idx) => `${item.id}-${item.pass?.id || idx}`}
          loading={loading}
          error={error}
          emptyMessage="No members found."
          onRowClick={(item) => router.push(`/dashboard/members/${item.id}`)}
        />
        {!loading && !error && sortedMembers.length > 0 && (
          <div className="flex items-center justify-between px-6 py-3 border-t border-border-subtle text-xs text-ink-secondary">
            <span>
              Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, sortedMembers.length)} of {sortedMembers.length} member{sortedMembers.length === 1 ? '' : 's'}
            </span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>Prev</Button>
              <span className="text-ink-muted">{currentPage} / {totalPages}</span>
              <Button variant="outline" size="sm" disabled={currentPage >= totalPages} onClick={() => setPage(currentPage + 1)}>Next</Button>
            </div>
          </div>
        )}
      </Card>
    </PageShell>
  );
}
