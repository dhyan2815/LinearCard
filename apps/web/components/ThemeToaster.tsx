'use client';

import React from 'react';
import { Toaster } from 'sonner';

// Mirrors the html.light class (set by the blocking script in layout.tsx / toggled
// by ThemeToggle) so toasts aren't hardcoded to dark while the app is in light mode.
export function ThemeToaster() {
  const [theme, setTheme] = React.useState<'light' | 'dark'>(() =>
    typeof document !== 'undefined' && document.documentElement.classList.contains('light') ? 'light' : 'dark'
  );

  React.useEffect(() => {
    const el = document.documentElement;
    const observer = new MutationObserver(() => {
      setTheme(el.classList.contains('light') ? 'light' : 'dark');
    });
    observer.observe(el, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  return <Toaster position="top-right" theme={theme} richColors />;
}
