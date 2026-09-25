'use client';

import { useState, useEffect } from 'react';
import { History, ChevronDown, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { apiClient } from '@/lib/api-client';
import { DataTable, DataTableColumn } from '@/components/ui/DataTable';
import { Card } from '@/components/ui/Card';

interface ScanHistoryEntry {
  id: string;
  createdAt: string;
  Member?: {
    name: string;
    phone: string;
  };
  details: {
    transactionType: 'award' | 'redeem';
    orderAmount: number;
    pointsChanged: number;
    newBalance: number;
  };
}

export function ScanHistoryTable({ refreshTrigger }: { refreshTrigger: number }) {
  const [history, setHistory] = useState<ScanHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [timeFilter, setTimeFilter] = useState('all');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const filterOptions = [
    { id: 'today', label: 'Today' },
    { id: 'this_week', label: 'This Week' },
    { id: 'this_month', label: 'This Month' },
    { id: 'last_month', label: 'Last Month' },
    { id: 'all', label: 'All Time' },
  ];

  const fetchHistory = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const result = await apiClient(`/passes/scan-history?timeFilter=${timeFilter}`);
      if (result.success) {
        setHistory(result.data || []);
      } else {
        setErrorMsg(result.error || 'Unknown API error');
      }
    } catch (err: any) {
      console.error('Failed to fetch scan history', err);
      setErrorMsg(err.message || 'Failed to fetch scan history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [timeFilter, refreshTrigger]);

  const columns: DataTableColumn<ScanHistoryEntry>[] = [
    {
      header: 'Time',
      className: 'whitespace-nowrap',
      render: (entry) =>
        new Date(entry.createdAt).toLocaleString([], {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }),
    },
    {
      header: 'Customer',
      render: (entry) => (
        <>
          <div className="font-semibold text-ink-dark">{entry.Member?.name || 'Unknown'}</div>
          <div className="text-xs text-ink-secondary font-mono mt-0.5">{entry.Member?.phone}</div>
        </>
      ),
    },
    {
      header: 'Action',
      render: (entry) => (
        <span
          className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full border ${
            entry.details.transactionType === 'award'
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
              : 'bg-brand-blue/10 text-brand-blue border-brand-blue/30'
          }`}
        >
          {entry.details.transactionType.toUpperCase()}
        </span>
      ),
    },
    {
      header: 'Order Amount',
      render: (entry) => <span className="text-ink-dark font-medium">₹{entry.details.orderAmount}</span>,
    },
    {
      header: 'Points',
      align: 'right',
      render: (entry) => (
        <>
          <div className={`font-bold ${entry.details.transactionType === 'award' ? 'text-emerald-400' : 'text-brand-blue'}`}>
            {entry.details.transactionType === 'award' ? '+' : '-'}{entry.details.pointsChanged}
          </div>
          <div className="text-[11px] text-ink-secondary mt-0.5">Bal: {entry.details.newBalance}</div>
        </>
      ),
    },
  ];

  return (
    <Card className="mt-8 animate-in fade-in">
      <div className="p-5 sm:p-6 border-b border-border-subtle flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h2 className="text-lg font-bold text-ink-dark flex items-center gap-2">
          <History className="w-5 h-5 text-brand-blue" />
          Scan & Transaction History
        </h2>
        
        {/* Filter Dropdown (Custom styling matching tenant selection) */}
        <div className="relative">
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="hover:bg-surface-hover rounded-md text-[13px] font-semibold text-ink-dark px-3 py-1.5 min-w-30 flex items-center justify-between border border-border-subtle bg-surface-card shadow-sm focus:outline-none transition-colors"
          >
            <span>{filterOptions.find(o => o.id === timeFilter)?.label || 'Filter'}</span>
            <ChevronDown className={`w-3.5 h-3.5 text-ink-muted shrink-0 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
          </button>
          
          <AnimatePresence>
            {isDropdownOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setIsDropdownOpen(false)} />
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  transition={{ duration: 0.15 }}
                  className="absolute top-full right-0 mt-1 w-40 bg-surface-card border border-border-subtle rounded-md shadow-lg z-50 overflow-hidden py-1 flex flex-col"
                >
                  <span className="text-[10px] uppercase font-semibold text-ink-muted px-3 py-1.5 tracking-wider">Date Range</span>
                  {filterOptions.map(option => (
                    <button
                      key={option.id}
                      onClick={() => {
                        setTimeFilter(option.id);
                        setIsDropdownOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 text-xs text-ink-dark hover:bg-canvas/80 flex items-center justify-between transition-colors outline-none focus:bg-canvas/80"
                    >
                      <span className="truncate">{option.label}</span>
                      {timeFilter === option.id && <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0 ml-2" />}
                    </button>
                  ))}
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={history}
        getRowKey={(entry) => entry.id}
        loading={loading}
        error={errorMsg}
        emptyMessage="No transactions found for the selected period."
      />
    </Card>
  );
}
