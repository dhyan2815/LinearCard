import React from 'react';
import { CreditCard, ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { supabase } from '@/lib/db';

export default async function TenantLayout({ children, params }: { children: React.ReactNode, params: Promise<{ slug: string }> }) {
  const resolvedParams = await params;
  const slug = resolvedParams.slug;
  let brandName = 'LinearCard';
  let logoUrl = '';
  
  if (slug !== 'default' && slug !== 'linearcard_demo') {
    const { data: tenant } = await supabase.from('Tenant').select('*').eq('classSuffix', slug).single();
    if (tenant) {
      brandName = tenant.name;
      logoUrl = tenant.logoUrl;
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-canvas text-ink-dark font-sans relative overflow-hidden">
      <div className="fixed inset-0 z-0 pointer-events-none opacity-20 bg-[radial-gradient(ellipse_at_top,var(--tw-gradient-stops))] from-border-strong via-canvas to-canvas" />

      <header className="border-b border-white/5 bg-canvas/80 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-ink-dark transition-colors">
              <ChevronLeft className="w-4 h-4" /> Back
            </Link>
            <div className="w-px h-4 bg-white/10 hidden sm:block"></div>
            <div className="flex items-center gap-3">
              {logoUrl ? (
                <img src={logoUrl} alt={brandName} className="w-8 h-8 rounded-lg object-cover" />
              ) : (
                <div className="w-8 h-8 rounded-lg bg-brand-orange flex items-center justify-center shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]">
                  <CreditCard className="w-4 h-4 text-white" />
                </div>
              )}
              <div className="flex flex-col">
                <span className="font-semibold text-base text-ink-dark tracking-tight leading-tight">{brandName}</span>
                {brandName !== 'LinearCard' && (
                  <span className="text-[10px] text-ink-muted font-medium uppercase tracking-wider">Powered by LinearCard</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="relative z-10 flex-1 flex flex-col">
        {children}
      </div>
    </div>
  );
}
