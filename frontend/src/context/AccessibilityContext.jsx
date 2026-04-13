import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const AccessibilityContext = createContext(null);

const STORAGE_KEY = 'a11y-prefs';
const FONT_STEPS = [1, 1.25, 1.5];

function loadPrefs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return null;
}

function savePrefs(prefs) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch { /* ignore */ }
}

const defaults = {
  highContrast: false,
  fontSizeIndex: 0,
  reduceMotion: false,
};

export function AccessibilityProvider({ children }) {
  const [prefs, setPrefs] = useState(() => ({ ...defaults, ...loadPrefs() }));

  useEffect(() => {
    savePrefs(prefs);

    const root = document.documentElement;

    root.classList.toggle('high-contrast', prefs.highContrast);
    root.classList.toggle('reduce-motion', prefs.reduceMotion);
    root.style.setProperty('--font-scale', String(FONT_STEPS[prefs.fontSizeIndex] ?? 1));
  }, [prefs]);

  const toggleHighContrast = useCallback(() => {
    setPrefs((p) => ({ ...p, highContrast: !p.highContrast }));
  }, []);

  const increaseFontSize = useCallback(() => {
    setPrefs((p) => ({ ...p, fontSizeIndex: Math.min(p.fontSizeIndex + 1, FONT_STEPS.length - 1) }));
  }, []);

  const decreaseFontSize = useCallback(() => {
    setPrefs((p) => ({ ...p, fontSizeIndex: Math.max(p.fontSizeIndex - 1, 0) }));
  }, []);

  const toggleReduceMotion = useCallback(() => {
    setPrefs((p) => ({ ...p, reduceMotion: !p.reduceMotion }));
  }, []);

  const resetAll = useCallback(() => {
    setPrefs({ ...defaults });
  }, []);

  const value = {
    ...prefs,
    fontScale: FONT_STEPS[prefs.fontSizeIndex] ?? 1,
    toggleHighContrast,
    increaseFontSize,
    decreaseFontSize,
    toggleReduceMotion,
    resetAll,
  };

  return (
    <AccessibilityContext.Provider value={value}>
      {children}
    </AccessibilityContext.Provider>
  );
}

export function useAccessibility() {
  const ctx = useContext(AccessibilityContext);
  if (!ctx) throw new Error('useAccessibility must be used within AccessibilityProvider');
  return ctx;
}
