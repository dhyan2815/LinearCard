import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import './globals.css';

export const metadata = {
  title: 'LinearCard - Wallet-Native Loyalty & Digital Identity Platform',
  description: 'The fastest way for brands in India to issue loyalty and membership passes to Apple, Google, and Samsung Wallets, powered by WhatsApp.',
  keywords: ['Apple Wallet', 'Google Wallet', 'Samsung Wallet', 'Digital Passes', 'Loyalty Program', 'Membership Card', 'LinearCard', 'WhatsApp Wallet Passes'],
  authors: [{ name: 'LinearCard Team' }],
  icons: {
    icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%232b00ff"><path d="M21 18v1c0 1.1-.9 2-2 2H5c-1.11 0-2-.9-2-2V5c0-1.1.89-2 2-2h14c1.1 0 2 .9 2 2v1h-9c-1.11 0-2 .9-2 2v8c0 1.1.89 2 2 2h9zm-9-2h10V8H12v8zm4-2.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/></svg>',
  }
};

export const viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f8fafc' },
    { media: '(prefers-color-scheme: dark)', color: '#09090b' },
  ],
  width: 'device-width',
  initialScale: 1,
};

import { ThemeToggle } from '../components/ThemeToggle';
import { ThemeToaster } from '../components/ThemeToaster';
import NextTopLoader from 'nextjs-toploader';

// Runs before paint so a saved 'light' preference never flashes dark first.
const themeInitScript = `(function(){try{var t=localStorage.getItem('theme');if(t==='light'){document.documentElement.classList.add('light');}else{document.documentElement.classList.remove('light');}}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="antialiased bg-canvas text-ink-dark selection:bg-brand-blue selection:text-white overflow-x-hidden">
        <NextTopLoader color="#2b00ff" showSpinner={false} height={3} />
        {children}
        <ThemeToggle />
        <ThemeToaster />
      </body>
    </html>
  );
}
