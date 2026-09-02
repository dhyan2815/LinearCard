'use client';

import React, { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';

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
}

  export default function PassPreviewCard({
    memberName = 'Dhyan Patel',
    cardTitle = 'LinearCard Platinum',
    hexBackgroundColor = '#D4AF37',
    barcodeValue = 'https://linearcard.vercel.app/m/882190',
    barcodeAltText = '882190',
    logoUrl = '',
    heroImageUrl = '',
    rows = [],
    manageTier = '',
    manageBalance = '',
    isManageTab = false,
    passId = ''
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
  const headerBg = hexBackgroundColor || '#1A365D';
  const cardBorder = isDarkMode ? 'border-neutral-800' : 'border-neutral-200';

  const displayPassId = passId || barcodeAltText || 'PREVIEW-882190';
  const displayBarcodeValue = passId ? `https://linearcard.vercel.app/m/${passId}` : (barcodeValue || 'https://linearcard.com');
  const shortPassId = displayPassId.length > 18 ? displayPassId.substring(0, 8).toUpperCase() : displayPassId;

  return (
    <div className="w-full max-w-112.5 mx-auto select-none sm:rounded-[2.5rem] rounded-3xl sm:border-8 border-zinc-950 shadow-2xl overflow-hidden flex flex-col transition-colors duration-300 relative bg-black ring-1 ring-white/10 h-[80vh] min-h-175 max-h-212.5">
      {/* Phone status bar placeholder (hidden on mobile) */}
      <div className="hidden sm:flex h-7 w-full justify-center items-start bg-transparent z-20 absolute top-0 pt-2 pointer-events-none">
        <div className="w-24 h-5 bg-zinc-950 rounded-full"></div>
      </div>
      
      {/* Google Wallet App Background */}
      <div 
        className="w-full flex-1 sm:pt-12 pt-6 pb-6 flex flex-col items-center overflow-y-auto overflow-x-hidden [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] scrollbar-none"
        style={{ backgroundColor: isDarkMode ? '#000000' : '#f8f9fa' }}
      >
        {/* Google Wallet Top Bar */}
        <div className="w-full h-12 flex items-center px-4 mb-3">
          <span className="font-medium text-[17px]" style={{color: textColor}}>Google Wallet</span>
        </div>

        <div className="w-[96%] mx-auto rounded-3xl overflow-hidden flex flex-col shadow-lg" style={{ backgroundColor: containerBg }}>
          
          {/* Top colored strip for GenericObject, containing Logo, Issuer, Subheader (Tier), and Header (Name) */}
          <div className="w-full flex flex-col pt-4 pb-6 px-5 relative" style={{ backgroundColor: headerBg }}>
             <div className="flex items-center mb-6">
               <div className="w-11 h-11 rounded-full bg-white overflow-hidden flex items-center justify-center shadow-md shrink-0 border border-black/5">
                 {/* Conditionally render the logo if provided, else fallback to initials */}
                 {logoUrl ? (
                   // eslint-disable-next-line @next/next/no-img-element
                   <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                 ) : (
                   <div className="w-full h-full bg-slate-100 flex items-center justify-center font-bold text-slate-400 text-sm">
                     {cardTitle ? cardTitle.substring(0, 2).toUpperCase() : 'LC'}
                   </div>
                 )}
               </div>
               
               {/* Header text beside logo */}
               <div className="ml-3 w-full min-w-0">
                  <span className="text-white font-medium text-[15px] truncate block">{cardTitle || 'Program Title'}</span>
               </div>
             </div>
             
             {/* Subheader and Header */}
             <div className="w-full min-w-0">
                <span className="text-white/80 text-[13px] font-medium block mb-1">
                  {/* If on manage tab, show manage tier; otherwise find the tier from the dynamic rows */}
                  {isManageTab && manageTier ? manageTier : (rows.find(r => r.columns.some((c: any) => c.header.toLowerCase().includes('tier')))?.columns.find((c: any) => c.header.toLowerCase().includes('tier'))?.body || 'Bronze')}
                </span>
                <span className="text-white text-2xl font-normal truncate block">
                  {memberName || 'Your Name'}
                </span>
             </div>
          </div>

          {/* Dynamic Rows: Only render if rows are provided */}
          {rows && rows.length > 0 && (
            <div className="px-5 py-5 space-y-4">
               {/* Map through each row and render its columns using CSS grid */}
               {rows.map((row: any, rIdx: number) => (
                 <div key={row.id || rIdx} className="grid gap-3" style={{ gridTemplateColumns: `repeat(${row.columns.length}, minmax(0, 1fr))` }}>
                   {row.columns.map((col: any, cIdx: number) => {
                     let displayBody = col.body;
                     
                     // Override the displayed body with manageTier/manageBalance if in Manage tab mode
                     if (isManageTab && col.header.toLowerCase().includes('tier') && manageTier) displayBody = manageTier;
                     if (isManageTab && (col.header.toLowerCase().includes('balance') || col.header.toLowerCase().includes('points')) && manageBalance) displayBody = manageBalance;
                     
                     return (
                       <div key={cIdx} className="min-w-0">
                         <span className="text-[11px] font-medium block mb-1 truncate" style={{ color: secondaryTextColor }}>
                           {col.header || 'Field'}
                         </span>
                         <span className="text-sm font-medium truncate block" style={{ color: textColor }}>
                           {displayBody || '-'}
                         </span>
                       </div>
                     );
                   })}
                 </div>
               ))}
            </div>
          )}

          {/* Barcode Section */}
          <div className={`mt-auto px-5 py-8 border-t ${cardBorder} flex flex-col items-center justify-center bg-white`}>
             <QRCodeSVG
                value={displayBarcodeValue}
                size={140}
                level="M"
                includeMargin={false}
              />
              <span className="mt-4 font-mono text-sm tracking-widest text-slate-900 font-medium text-center">
                {shortPassId}
              </span>
          </div>

          {/* Hero Image: Only render if a URL is provided (Google Wallet renders this at the bottom of the pass) */}
          {heroImageUrl && (
            <div className="w-full h-40 bg-neutral-200 overflow-hidden mt-auto">
               {/* eslint-disable-next-line @next/next/no-img-element */}
               <img src={heroImageUrl} alt="Hero" className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
            </div>
          )}
          
        </div>
      </div>
    </div>
  );
}
