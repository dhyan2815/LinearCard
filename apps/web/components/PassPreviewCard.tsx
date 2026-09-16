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
  archetype?: string;
  linksModuleData?: Array<{ id?: string; uri: string; description: string }>;
  imageModulesData?: Array<{ id?: string; imageUrl: string; description?: string }>;
  textModulesData?: Array<{ id?: string; header: string; body: string }>;
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
    passId = '',
    archetype = 'membership',
    linksModuleData = [],
    imageModulesData = [],
    textModulesData = []
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
    <div className="w-full max-w-112.5 mx-auto select-none sm:rounded-[2.5rem] rounded-3xl sm:border-8 border-zinc-950 shadow-2xl overflow-hidden flex flex-col transition-all duration-500 relative bg-black ring-1 ring-white/10 h-[80vh] min-h-175 max-h-212.5">
      {/* Phone status bar placeholder (hidden on mobile) */}
      <div className="hidden sm:flex h-7 w-full justify-center items-start bg-transparent z-20 absolute top-0 pt-2 pointer-events-none">
        <div className="w-24 h-5 bg-zinc-950 rounded-full"></div>
      </div>
      
      {/* Google Wallet App Background */}
      <div 
        className="w-full flex-1 sm:pt-12 pt-6 pb-6 flex flex-col items-center overflow-y-auto overflow-x-hidden [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] scrollbar-none transition-colors duration-500 relative"
        style={{ backgroundColor: isDarkMode ? '#000000' : '#f8f9fa' }}
      >
        {/* Google Wallet Top Bar */}
        <div className="w-full h-12 flex items-center px-4 mb-3 shrink-0">
          <span className="font-medium text-[17px] transition-colors duration-500" style={{color: textColor}}>Google Wallet</span>
        </div>

        <div className="w-[96%] mx-auto rounded-3xl overflow-hidden flex flex-col shadow-lg transition-all duration-500 relative" style={{ backgroundColor: containerBg }}>
          
          {/* Top colored strip for GenericObject, containing Logo, Issuer, Subheader (Tier), and Header (Name) */}
          <div className="w-full flex flex-col pt-4 pb-6 px-5 relative transition-colors duration-500" style={{ backgroundColor: headerBg }}>
             <div className="flex items-center mb-6 justify-between">
               <div className="flex items-center">
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
             </div>
             
             {/* Subheader and Header */}
             <div className="w-full min-w-0 flex flex-col items-center sm:items-start text-center sm:text-left">
                <span className="text-white/80 text-[13px] font-medium block mb-1">
                  {/* If on manage tab, show manage tier; otherwise find the tier from the dynamic rows */}
                  {isManageTab && manageTier ? manageTier : (rows.find(r => r.columns.some((c: any) => c.header.toLowerCase().includes('tier')))?.columns.find((c: any) => c.header.toLowerCase().includes('tier'))?.body || 'Bronze')}
                </span>
                <span className="text-white text-2xl font-normal truncate block w-full">
                  {memberName || 'Your Name'}
                </span>
             </div>
          </div>

          {/* Dynamic Rows: Only render if rows are provided */}
          {rows && rows.length > 0 && (
            <div className="px-5 py-5 space-y-4 transition-all duration-500">
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
                         <span className="text-[11px] font-medium block mb-1 truncate transition-colors duration-500" style={{ color: secondaryTextColor }}>
                           {col.header || 'Field'}
                         </span>
                         <span className="text-sm font-medium truncate block transition-colors duration-500" style={{ color: textColor }}>
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
          <div className={`mt-auto px-5 py-8 border-t ${cardBorder} flex flex-col items-center justify-center bg-white transition-colors duration-500`}>
             <QRCodeSVG
                value={displayBarcodeValue}
                size={140}
                level="M"
                includeMargin={false}
              />
          </div>

          {/* Hero Image: Only render if a URL is provided (Google Wallet renders this at the bottom of the pass) */}
          {heroImageUrl && (
            <div className="w-full h-40 bg-neutral-200 overflow-hidden shrink-0">
               {/* eslint-disable-next-line @next/next/no-img-element */}
               <img src={heroImageUrl} alt="Hero" className="w-full h-full object-cover transition-opacity duration-500" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
            </div>
          )}

          {/* Details Section: Image Modules, Text Modules, and Link Modules */}
          {((imageModulesData && imageModulesData.length > 0) ||
            (textModulesData && textModulesData.length > 0) ||
            (linksModuleData && linksModuleData.length > 0)) && (
            <div className={`px-5 py-5 border-t ${cardBorder} space-y-4 transition-all duration-500`} style={{ backgroundColor: containerBg }}>
              
              {/* Promotional Banners (Image Modules) */}
              {imageModulesData && imageModulesData.filter(img => img.imageUrl).map((img, idx) => (
                <div key={img.id || idx} className="rounded-xl overflow-hidden border border-neutral-200 dark:border-neutral-800 shadow-sm">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.imageUrl}
                    alt={img.description || 'Promotional Banner'}
                    className="w-full h-28 object-cover"
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  />
                  {img.description && (
                    <div className="p-2 text-[11px] text-neutral-600 dark:text-neutral-400 bg-neutral-50 dark:bg-neutral-900 truncate">
                      {img.description}
                    </div>
                  )}
                </div>
              ))}

              {/* Information Blocks (Text Modules) */}
              {textModulesData && textModulesData.filter(txt => txt.header).map((txt, idx) => (
                <div key={txt.id || idx} className="space-y-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wider block transition-colors duration-500" style={{ color: secondaryTextColor }}>
                    {txt.header}
                  </span>
                  <p className="text-xs leading-relaxed whitespace-pre-wrap transition-colors duration-500" style={{ color: textColor }}>
                    {txt.body || '-'}
                  </p>
                </div>
              ))}

              {/* Quick Links & Actions (Link Modules) */}
              {linksModuleData && linksModuleData.filter(l => l.uri || l.description).length > 0 && (
                <div className="pt-2 border-t border-neutral-200/60 dark:border-neutral-800/80">
                  <span className="text-[10px] font-semibold uppercase tracking-wider block mb-2 transition-colors duration-500" style={{ color: secondaryTextColor }}>
                    Quick Links & Actions
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {linksModuleData.filter(l => l.uri || l.description).map((link, idx) => (
                      <a
                        key={link.id || idx}
                        href={link.uri || '#'}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all shadow-sm border bg-neutral-100 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-blue-600 dark:text-blue-400 hover:bg-neutral-200 dark:hover:bg-neutral-700 max-w-full truncate"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span className="truncate">{link.description || link.uri || 'Link'}</span>
                        <span className="text-[10px] opacity-70">↗</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          
        </div>
      </div>
    </div>
  );
}
