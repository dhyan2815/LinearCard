'use client';
import React from 'react';
import { motion } from 'motion/react';
import PassPreviewCard from '@/components/PassPreviewCard';
import { TemplateWorkspace } from '../_components/TemplateWorkspace';
import { useDashboard } from '../_components/DashboardContext';
import { PageShell } from '@/components/ui/PageShell';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { QRCodeSVG } from 'qrcode.react';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';

export default function TemplateDesignerPage() {
  const [previewPlatform, setPreviewPlatform] = React.useState<'google' | 'apple'>('google');
  const {
    designData,
    setDesignData,
    origin,
    templateStatus,
    savedTemplateId,
    setSavedTemplateId,
    setTemplateStatus,
    currentTenant,
    selectedTenantId,
    currentProgram,
    manageData,
    stats
  } = useDashboard();

  const [previewLoading, setPreviewLoading] = React.useState(false);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const workspaceRef = React.useRef<any>(null);

  const handlePreviewOnDevice = async () => {
    if (!workspaceRef.current) return;
    setPreviewLoading(true);
    const previewPromise = async () => {
      const tplId = await workspaceRef.current.saveTemplate();
      const data = await apiClient(`/templates/${tplId}/preview-pass`, { method: 'POST' });
      if (!data.success) throw new Error(data.error || 'Failed to build preview pass');
      setPreviewUrl(data.googleWalletUrl);
      return data;
    };

    toast.promise(previewPromise().finally(() => setPreviewLoading(false)), {
      loading: 'Building preview pass...',
      success: 'Scan the QR to add it to your Wallet.',
      error: (err: any) => err.message || 'Preview failed',
    });
  };

  const previewModal = previewUrl ? (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-surface-card border border-border-subtle rounded-2xl p-6 shadow-xl text-center">
        <div className="flex items-start justify-between mb-4">
          <div className="text-left">
            <h3 className="text-sm font-semibold text-ink-dark">Preview on device</h3>
            <p className="text-xs text-ink-muted mt-1">
              Scan with the phone you want the pass on. This is a throwaway
              pass — it never counts in your stats.
            </p>
          </div>
          <button type="button" onClick={() => setPreviewUrl(null)} className="text-ink-muted hover:text-ink-dark shrink-0" aria-label="Close preview">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="inline-block p-3 bg-white rounded-xl">
          <QRCodeSVG value={previewUrl} size={256} level="Q" includeMargin={true} />
        </div>
        <div className="mt-4 flex gap-2">
          <Button
            type="button"
            variant="secondary"
            className="flex-1"
            onClick={() => {
              navigator.clipboard.writeText(previewUrl);
              toast.success('Preview link copied');
            }}
          >
            Copy link
          </Button>
          <a href={previewUrl} target="_blank" rel="noopener noreferrer" className="flex-1">
            <Button type="button" className="w-full">Open</Button>
          </a>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <PageShell>
      <PageHeader
        title="Template Designer"
        description="Design your pass template and preview it live before publishing."
        actions={
          <div className="flex items-center rounded-full border border-neutral-200 dark:border-neutral-800 p-1 text-sm">
            {(['google', 'apple'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPreviewPlatform(p)}
                className={`px-3 py-1 rounded-full transition-colors ${previewPlatform === p ? 'bg-neutral-900 text-white dark:bg-white dark:text-black' : 'text-neutral-500'}`}
              >
                {p === 'google' ? 'Google Wallet' : 'Apple Wallet'}
              </button>
            ))}
          </div>
        }
      />
      {previewModal}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 lg:gap-12">
         <div className="xl:col-span-7 flex flex-col gap-6">
           <TemplateWorkspace 
               ref={workspaceRef}
               designData={designData}
               setDesignData={setDesignData}
               origin={origin}
               templateStatus={templateStatus}
               savedTemplateId={savedTemplateId}
               setSavedTemplateId={setSavedTemplateId}
               setTemplateStatus={setTemplateStatus}
               currentTenant={currentTenant}
               selectedTenantId={selectedTenantId}
               currentProgram={currentProgram}
               passCount={stats?.passCount || 0}
           />
         </div>
         <div className="xl:col-span-5 flex justify-center xl:justify-start xl:pl-12 xl:sticky xl:top-0">
           <div className="flex flex-col gap-4 w-full sm:w-[320px]">
             <div className="flex justify-end">
               <Button type="button" variant="secondary" disabled={previewLoading} onClick={handlePreviewOnDevice} className="w-full sm:w-auto">
                 Preview on device
               </Button>
             </div>
             <motion.div whileHover={{ scale: 1.02, rotateY: -2, rotateX: 2 }} transition={{ type: "spring", stiffness: 200, damping: 20 }} className="w-full">
               <PassPreviewCard
                 platform={previewPlatform}
                 memberName={manageData.passId ? 'Live Pass' : 'Dhyan Patel'}
                 cardTitle={designData.cardTitle}
                 hexBackgroundColor={designData.hexBackgroundColor}
                 barcodeAltText={'882190'}
                 barcodeValue={'https://linearcard.vercel.app/member/882190'}
                 logoUrl={designData.logoUrl}
                 heroImageUrl={designData.heroImageUrl}
                 rows={designData.rows}
                 manageTier={manageData.tier}
                 manageBalance={manageData.balance}
                 isManageTab={false}
                 archetype={designData.archetype}
                 setDesignData={setDesignData}
               />
             </motion.div>
           </div>
         </div>
      </div>
    </PageShell>
  );
}
