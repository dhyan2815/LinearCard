'use client';

import React from 'react';
import { Sun, Moon } from 'lucide-react';

export function ThemeToggle() {
  // The blocking script in layout.tsx already set the html class before paint;
  // just mirror it into state so this component's icon matches.
  const [theme, setTheme] = React.useState(() =>
    typeof document !== 'undefined' && document.documentElement.classList.contains('light') ? 'light' : 'dark'
  );

  const toggleTheme = () => {
    // If the current theme is dark, switch to light mode and save preference
    if (theme === 'dark') {
      document.documentElement.classList.add('light');
      // Store in localStorage for persistence across reloads
      localStorage.setItem('theme', 'light');
      setTheme('light');
    } else {
      // Otherwise, switch back to dark mode
      document.documentElement.classList.remove('light');
      localStorage.setItem('theme', 'dark');
      setTheme('dark');
    }
  };

  return (
    <button
      onClick={toggleTheme}
      className="fixed bottom-6 right-6 z-50 p-3 rounded-full bg-surface-card border border-border-strong text-ink-dark shadow-lg hover:scale-105 active:scale-95 transition-all"
      aria-label="Toggle theme"
    >
      {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
    </button>
  );
}
