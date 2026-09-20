'use client';

import React, { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { DEFAULT_PASS_HEX } from '@linearcard/types';

export interface PassPreviewCardProps {
  memberName?: string;
  cardTitle?: string;
  hexBackgroundColor?: string;
  barcodeValue?: string;
  barcodeAltText?: string;
  logoUrl?: string;
  heroImageUrl?: string;
  rows?: any[];
  manageTier?: string;
  manageBalance?: string;
  isManageTab?: boolean;
  passId?: string;
  archetype?: string;
  setDesignData?: any;
  platform?: 'apple' | 'google';
}

export default function PassPreviewCard({
  memberName = 'Dhyan Patel',
  cardTitle = 'LinearCard Platinum',
  hexBackgroundColor = DEFAULT_PASS_HEX,
  barcodeValue = 'https://linearcard.vercel.app/m/882190',
  barcodeAltText = '882190',
  logoUrl = '',
  heroImageUrl = '',
  rows = [],
  manageTier = '',
  manageBalance = '',
  isManageTab = false,
  passId = '',
  archetype = 'membership',
  setDesignData,
  platform = 'google'
}: PassPreviewCardProps): React.JSX.Element {
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    // Detect system preference to toggle dark mode
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    setIsDarkMode(mediaQuery.matches);

    // Update state whenever the system color scheme changes
    const handler = (e: MediaQueryListEvent) => setIsDarkMode(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  // System themed colors mimicking Android Google Wallet native UI
  const containerBg = isDarkMode ? '#1e1e1e' : '#ffffff';
  const textColor = isDarkMode ? '#ffffff' : '#1e1e1e';
  const secondaryTextColor = isDarkMode ? '#a0a0a0' : '#5f6368';
  const headerBg = hexBackgroundColor || DEFAULT_PASS_HEX;
  const cardBorder = isDarkMode ? 'border-neutral-800' : 'border-neutral-200';

  const displayPassId = passId || barcodeAltText || 'PREVIEW-882190';
  const displayBarcodeValue = passId ? `https://linearcard.vercel.app/m/${passId}` : (barcodeValue || 'https://linearcard.com');
  const shortPassId = displayPassId.length > 18 ? displayPassId.substring(0, 8).toUpperCase() : displayPassId;

  const EditableField = ({ value, onChange, className, style, placeholder, isEditable }: any) => {
    if (!isEditable) {
      return <span className={`block truncate ${className}`} style={style}>{value || placeholder}</span>;
    }
    return (
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`bg-transparent border-none outline-none focus:ring-1 focus:ring-white/30 rounded px-1 -ml-1 w-full truncate ${className}`}
        style={style}
        placeholder={placeholder}
      />
    );
  };

  const handleUpdateRow = (rIdx: number, cIdx: number, field: 'header' | 'body', value: string) => {
    if (!setDesignData) return;
    setDesignData((prev: any) => {
      const newRows = [...prev.rows];
      newRows[rIdx] = { ...newRows[rIdx], columns: [...newRows[rIdx].columns] };
      newRows[rIdx].columns[cIdx] = { ...newRows[rIdx].columns[cIdx], [field]: value };
      return { ...prev, rows: newRows };
    });
  };

  const renderRows = () => rows && rows.length > 0 && (
    <div className="px-6 py-6 space-y-7 transition-all duration-500 flex-1">
       {rows.map((row: any, rIdx: number) => (
         <div key={row.id || rIdx} className="grid gap-4" style={{ gridTemplateColumns: `repeat(${row.columns.length}, minmax(0, 1fr))` }}>
           {row.columns.map((col: any, cIdx: number) => {
             let displayBody = col.body;

             if (isManageTab && col.header.toLowerCase().includes('tier') && manageTier) displayBody = manageTier;
             if (isManageTab && (col.header.toLowerCase().includes('balance') || col.header.toLowerCase().includes('points')) && manageBalance) displayBody = manageBalance;

             return (
               <div key={cIdx} className="min-w-0 flex flex-col">
                 <EditableField
                   value={col.header}
                   onChange={(v: string) => handleUpdateRow(rIdx, cIdx, 'header', v)}
                   className="text-xs font-medium mb-1 transition-colors duration-500"
                   style={{ color: secondaryTextColor }}
                   placeholder="Field Label"
                   isEditable={!!setDesignData}
                 />
                 {isManageTab ? (
                   <span className="text-[15px] font-medium truncate block transition-colors duration-500" style={{ color: textColor }}>
                     {displayBody || '-'}
                   </span>
                 ) : (
                   <EditableField
                     value={col.body}
                     onChange={(v: string) => handleUpdateRow(rIdx, cIdx, 'body', v)}
                     className="text-[15px] font-medium transition-colors duration-500"
                     style={{ color: textColor }}
                     placeholder="Value"
                     isEditable={!!setDesignData}
                   />
                 )}
               </div>
             );
           })}
         </div>
       ))}
    </div>
  );

  const logo = (
    <div className="w-12 h-12 rounded-full bg-white overflow-hidden flex items-center justify-center shrink-0 shadow-sm border border-black/5">
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
      ) : (
        <div className="w-full h-full bg-slate-100 flex items-center justify-center font-bold text-slate-400 text-sm">
          {cardTitle ? cardTitle.substring(0, 2).toUpperCase() : 'LC'}
        </div>
      )}
    </div>
  );

  const tierLabel = isManageTab && manageTier
    ? manageTier
    : (rows.find((r: any) => r.columns.some((c: any) => c.header.toLowerCase().includes('tier')))?.columns.find((c: any) => c.header.toLowerCase().includes('tier'))?.body || 'Member');

  if (platform === 'apple') {
    return (
      <div className="w-full max-w-90 mx-auto select-none">
        <div className="rounded-3xl overflow-hidden flex flex-col shadow-[0_20px_45px_-15px_rgba(0,0,0,0.4)] relative transition-colors duration-500" style={{ backgroundColor: headerBg }}>
          {/* Punch hole notch */}
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-16 h-6 bg-black/20 rounded-full z-10" />

          <div className="px-5 pt-6 pb-4">
            <div className="flex items-start justify-between mb-6">
              {logo}
              <div className="text-right max-w-[55%]">
                <EditableField
                  value={cardTitle}
                  onChange={(v: string) => setDesignData?.((prev: any) => ({ ...prev, cardTitle: v }))}
                  className="text-white/90 font-medium text-xs uppercase tracking-wide"
                  placeholder="Header"
                  isEditable={!!setDesignData}
                />
              </div>
            </div>

            <div className="flex items-end justify-between gap-4">
              <div className="min-w-0">
                <span className="text-white/70 text-[11px] font-medium uppercase tracking-wide block mb-1">{tierLabel}</span>
                <span className="text-white text-2xl font-semibold truncate block leading-tight">{memberName || 'Your Name'}</span>
              </div>
              {heroImageUrl && (
                <div className="w-16 h-16 rounded-lg overflow-hidden shrink-0 border border-white/20">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={heroImageUrl} alt="Strip" className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                </div>
              )}
            </div>
          </div>

          <div className="transition-colors duration-500" style={{ backgroundColor: containerBg }}>
            {renderRows()}

            <div className="px-6 py-8 flex flex-col items-center justify-center bg-white border-t border-black/5">
              <div className="w-42.5 h-42.5 flex items-center justify-center mb-3">
                <QRCodeSVG value={displayBarcodeValue} size={160} level="M" includeMargin={false} />
              </div>
              <span className="text-zinc-600 font-mono text-[13px] tracking-widest mt-1">{shortPassId}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-90 mx-auto select-none rounded-3xl overflow-hidden flex flex-col transition-all duration-500 relative border border-black/5 dark:border-white/5" style={{ backgroundColor: containerBg }}>

      {/* Top colored strip for GenericObject */}
      <div className="w-full flex flex-col pt-5 pb-6 px-6 relative transition-colors duration-500" style={{ backgroundColor: headerBg }}>
         <div className="flex items-start justify-between mb-8">
           {logo}

           <div className="ml-4 flex-1 min-w-0 mt-1">
             <EditableField
               value={cardTitle}
               onChange={(v: string) => setDesignData?.((prev: any) => ({...prev, cardTitle: v}))}
               className="text-white font-medium text-base text-right"
               placeholder="Program Title"
               isEditable={!!setDesignData}
             />
           </div>
         </div>

         {/* Main Title text (User Name usually for Generic/Loyalty) */}
         <div className="w-full min-w-0 flex flex-col items-start">
            <span className="text-white/80 text-[13px] font-medium block mb-1">{tierLabel}</span>
            <span className="text-white text-[28px] font-normal truncate block w-full leading-tight">
              {memberName || 'Your Name'}
            </span>
         </div>
      </div>

      {/* Hero Image */}
      {heroImageUrl && (
        <div className="w-full h-45 bg-neutral-200 overflow-hidden shrink-0 border-b border-black/5">
           {/* eslint-disable-next-line @next/next/no-img-element */}
           <img src={heroImageUrl} alt="Hero" className="w-full h-full object-cover transition-opacity duration-500" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
        </div>
      )}

      {renderRows()}

      {/* Barcode Section */}
      <div className="px-6 py-8 flex flex-col items-center justify-center bg-white transition-colors duration-500 mt-auto border-t border-black/5">
         <div className="w-42.5 h-42.5 flex items-center justify-center mb-3">
           <QRCodeSVG
              value={displayBarcodeValue}
              size={160}
              level="M"
              includeMargin={false}
            />
         </div>
         <span className="text-zinc-600 font-mono text-[13px] tracking-widest mt-1">{shortPassId}</span>
      </div>
    </div>
  );
}
