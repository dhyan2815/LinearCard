'use client';
import React from 'react';
import { motion } from 'motion/react';
import PassPreviewCard from '@/components/PassPreviewCard';
import { TemplateWorkspace } from '../_components/TemplateWorkspace';
import { useDashboard } from '../_components/DashboardContext';
import { PageShell } from '@/components/ui/PageShell';
import { PageHeader } from '@/components/ui/PageHeader';

export default function TemplateDesignerPage() {
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
    manageData,
    stats
  } = useDashboard();

  return (
    <PageShell>
      <PageHeader
        title="Template Designer"
        description="Design your pass template and preview it live before publishing."
      />
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 lg:gap-12">
         <div className="xl:col-span-7 flex flex-col gap-6">
           <TemplateWorkspace 
               designData={designData}
               setDesignData={setDesignData}
               origin={origin}
               templateStatus={templateStatus}
               savedTemplateId={savedTemplateId}
               setSavedTemplateId={setSavedTemplateId}
               setTemplateStatus={setTemplateStatus}
               currentTenant={currentTenant}
               selectedTenantId={selectedTenantId}
               passCount={stats.passCount}
           />
         </div>
         <div className="xl:col-span-5 flex justify-center xl:justify-start xl:pl-12 xl:sticky xl:top-0">
           <motion.div whileHover={{ scale: 1.02, rotateY: -2, rotateX: 2 }} transition={{ type: "spring", stiffness: 200, damping: 20 }} className="w-full sm:w-[320px]">
             <PassPreviewCard
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
    </PageShell>
  );
}
