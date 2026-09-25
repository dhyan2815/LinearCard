'use client';

import React, { useEffect } from 'react';
import { Sun, Moon } from 'lucide-react';

export function ThemeToggle() {
  // Default to dark to avoid hydration mismatch; useEffect syncs with actual DOM
  const [theme, setTheme] = React.useState('dark');

  useEffect(() => {
    const isDarkMode = !document.documentElement.classList.contains('light');
    setTheme(isDarkMode ? 'dark' : 'light');
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
