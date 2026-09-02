'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Users, Search, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { buttonBaseClass, buttonVariants } from '@/components/ui/Button';
import { clsx } from 'clsx';

export default function MembersPage() {
  const [members, setMembers] = useState<any[]>([]);
  const [tenants, setTenants] = useState<any[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    // Fetch members
    fetch('/api/members')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setMembers(data.members || []);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));

    // Fetch tenants
    fetch('/api/tenants')
      .then(res => res.json())
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

  return (
    <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-8">
      <div className="mb-8 flex justify-between items-center">
        <Link href="/dashboard" className={clsx(buttonBaseClass, buttonVariants.secondary, "py-2")}>
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </Link>
      </div>

      <div className="mb-10 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-ink-dark tracking-tight mb-2 flex items-center gap-3">
            <Users className="w-8 h-8 text-brand-orange" />
            Members List
          </h1>
          <p className="text-sm text-ink-secondary">View and search through all enrolled members.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <div className="flex flex-col items-start gap-1 w-full sm:w-auto">
             <label className="text-xs font-medium text-ink-secondary">Filter Tenant</label>
             <select 
               value={selectedTenantId} 
               onChange={(e) => setSelectedTenantId(e.target.value)} 
               className="w-full sm:w-48 bg-surface-card border border-border-subtle rounded-lg px-3 py-2 text-sm text-ink-dark focus:outline-none focus:border-brand-orange"
             >
                <option value="all">All Brands</option>
                {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
             </select>
          </div>
          <div className="flex flex-col items-start gap-1 w-full sm:w-auto">
             <label className="text-xs font-medium text-ink-secondary">Search</label>
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
        </div>
      </div>

      <Card className="overflow-hidden border-border-subtle bg-surface-card">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-bone text-ink-secondary font-medium border-b border-border-subtle">
              <tr>
                <th className="px-6 py-4">Name</th>
                <th className="px-6 py-4">Phone Number</th>
                <th className="px-6 py-4">Pass ID</th>
                <th className="px-6 py-4">Tier</th>
                <th className="px-6 py-4">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-ink-muted">Loading members...</td>
                </tr>
              ) : flatMembers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-ink-muted">No members found.</td>
                </tr>
              ) : (
                flatMembers.map((item, idx) => (
                  <tr key={`${item.id}-${item.pass?.id || idx}`} className="hover:bg-surface-bone/50 transition-colors">
                    <td className="px-6 py-4 font-medium text-ink-dark">{item.name || '—'}</td>
                    <td className="px-6 py-4 font-mono text-ink-secondary">{item.phone}</td>
                    <td className="px-6 py-4 font-mono text-xs text-ink-secondary">
                      {item.pass ? (
                        <div className="flex items-center gap-2">
                           <span className="truncate max-w-30 inline-block" title={item.pass.id}>{item.pass.id}</span>
                        </div>
                      ) : (
                        <span className="italic">No Pass</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-ink-secondary">
                      {item.pass ? item.pass.tier : '—'}
                    </td>
                    <td className="px-6 py-4 text-ink-secondary">
                      {item.pass ? item.pass.balance : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </main>
  );
}
