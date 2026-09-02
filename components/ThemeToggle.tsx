'use client';

import React from 'react';
import { Sun, Moon } from 'lucide-react';

export function ThemeToggle() {
  const [theme, setTheme] = React.useState('dark');

  React.useEffect(() => {
    // Check initial theme from html tag
    const isLight = document.documentElement.classList.contains('light');
    setTheme(isLight ? 'light' : 'dark');
  }, []);

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

  // Restore on mount
  React.useEffect(() => {
    const saved = localStorage.getItem('theme');
    // Apply the saved theme preference on initial load
    if (saved === 'light') {
      document.documentElement.classList.add('light');
      setTheme('light');
    } else {
      document.documentElement.classList.remove('light');
      setTheme('dark');
    }
  }, []);

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
