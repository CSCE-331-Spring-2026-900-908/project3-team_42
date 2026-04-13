import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAccessibility } from '../context/AccessibilityContext';
import { speechSupported } from '../hooks/useSpeechRecognition';

const FONT_LABELS = ['100%', '125%', '150%'];

const SHORTCUTS = [
  { keys: 'Alt + 1–5', action: 'Go to page 1–5 (Windows / some browsers)' },
  { keys: 'Ctrl + Shift + 1–5', action: 'Go to page 1–5 (recommended on Mac)' },
  { keys: 'Alt + C or Ctrl + Shift + K', action: 'Focus cart / checkout' },
  { keys: 'Escape', action: 'Close panel, modal, or chat' },
  { keys: 'Shift + /', action: 'Show keyboard shortcuts (same as ?)' },
];

const NAV_ROUTES = ['/', '/manager', '/cashier', '/customer', '/menuboard'];

function getA11yMount() {
  if (typeof document === 'undefined') return null;
  return document.getElementById('a11y-root') ?? document.body;
}

function navIndexFromCode(code) {
  const map = {
    Digit1: 0,
    Digit2: 1,
    Digit3: 2,
    Digit4: 3,
    Digit5: 4,
    Numpad1: 0,
    Numpad2: 1,
    Numpad3: 2,
    Numpad4: 3,
    Numpad5: 4,
  };
  return map[code] ?? -1;
}

export default function AccessibilityPanel() {
  const {
    highContrast,
    fontSizeIndex,
    reduceMotion,
    toggleHighContrast,
    increaseFontSize,
    decreaseFontSize,
    toggleReduceMotion,
    resetAll,
  } = useAccessibility();

  const [open, setOpen] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const panelRef = useRef(null);
  const triggerRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();

  const closePanel = useCallback(() => {
    setOpen(false);
    setShowHelp(false);
    triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      const tag = (e.target || {}).tagName;
      const inField =
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        (e.target || {}).isContentEditable;

      const idx = navIndexFromCode(e.code);
      const navShortcut =
        idx >= 0 &&
        ((e.altKey && !e.ctrlKey && !e.metaKey) ||
          (e.ctrlKey && e.shiftKey && !e.metaKey));

      if (navShortcut) {
        e.preventDefault();
        e.stopPropagation();
        const route = NAV_ROUTES[idx];
        if (route && route !== location.pathname) navigate(route);
        return;
      }

      const cartShortcut =
        (!inField &&
          e.altKey &&
          !e.ctrlKey &&
          !e.metaKey &&
          (e.code === 'KeyC' || e.key === 'c' || e.key === 'C')) ||
        (!inField &&
          e.ctrlKey &&
          e.shiftKey &&
          !e.metaKey &&
          (e.code === 'KeyK' || e.key === 'k' || e.key === 'K'));

      if (cartShortcut) {
        e.preventDefault();
        e.stopPropagation();
        const cart = document.getElementById('cart-region') || document.getElementById('checkout-btn');
        cart?.focus();
        return;
      }

      if (e.key === 'Escape') {
        if (showHelp) {
          e.stopPropagation();
          setShowHelp(false);
          return;
        }
        if (open) {
          e.stopPropagation();
          closePanel();
          return;
        }
      }

      const isQuestion =
        e.key === '?' ||
        (e.shiftKey && e.key === '/') ||
        (e.shiftKey && e.code === 'Slash');

      if (isQuestion && !e.ctrlKey && !e.altKey && !e.metaKey) {
        if (inField) return;
        e.preventDefault();
        setShowHelp((v) => !v);
        if (!open) setOpen(true);
      }
    };

    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, showHelp, closePanel, navigate, location.pathname]);

  useEffect(() => {
    if (!open) return;
    const trap = (e) => {
      if (e.key !== 'Tab' || !panelRef.current) return;
      const focusable = panelRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', trap, true);
    return () => window.removeEventListener('keydown', trap, true);
  }, [open]);

  const btnBase =
    'flex items-center justify-center gap-2 rounded-xl border-2 px-4 py-3 text-sm font-bold transition-colors min-h-[48px] min-w-[48px]';
  const btnOff = 'border-stone-300 bg-white text-stone-800 hover:bg-stone-100';
  const btnOn = 'border-violet-600 bg-violet-600 text-white hover:bg-violet-700';

  const content = (
    <div
      className="pointer-events-none fixed inset-0"
      style={{ zIndex: 2147483647 }}
      data-a11y-overlay=""
    >
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="pointer-events-auto fixed left-6 bottom-6 z-[1] flex h-14 w-14 items-center justify-center rounded-full border-2 border-stone-400 bg-white text-xl shadow-xl transition hover:bg-violet-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-violet-500"
        aria-label={open ? 'Close accessibility settings' : 'Open accessibility settings'}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <circle cx="12" cy="4.5" r="2" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v3m0 0l-3 7m3-7l3 7M7 11h10" />
        </svg>
      </button>

      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label="Accessibility settings"
          className="pointer-events-auto fixed left-6 bottom-24 z-[1] max-h-[min(calc(100vh-7rem),560px)] w-[min(92vw,380px)] overflow-y-auto rounded-2xl border-2 border-stone-300 bg-white p-5 shadow-2xl"
        >
          <div className="mb-4 flex items-center justify-between gap-2">
            <h2 id="a11y-panel-title" className="text-lg font-bold text-stone-900">
              Accessibility
            </h2>
            <button
              type="button"
              onClick={closePanel}
              className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-lg p-2 text-stone-500 hover:bg-stone-100 hover:text-stone-900"
              aria-label="Close accessibility panel"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="space-y-3">
            <button type="button" onClick={toggleHighContrast} className={`${btnBase} w-full ${highContrast ? btnOn : btnOff}`}>
              <span aria-hidden="true">&#9681;</span>
              High contrast {highContrast ? 'ON' : 'OFF'}
            </button>

            <div className={`${btnBase} w-full border-stone-300 bg-white justify-between`}>
              <div className="flex items-center gap-2 text-stone-800">
                <span aria-hidden="true" className="text-lg font-black">A</span>
                <span>Text size: {FONT_LABELS[fontSizeIndex]}</span>
              </div>
              <div className="flex items-center gap-1">
                <button 
                  type="button" 
                  onClick={decreaseFontSize} 
                  disabled={fontSizeIndex === 0} 
                  className="flex h-8 w-8 items-center justify-center rounded bg-stone-100 hover:bg-stone-200 disabled:opacity-50 text-stone-800 font-bold"
                  aria-label="Decrease text size"
                >
                  -
                </button>
                <button 
                  type="button" 
                  onClick={increaseFontSize} 
                  disabled={fontSizeIndex === FONT_LABELS.length - 1} 
                  className="flex h-8 w-8 items-center justify-center rounded bg-stone-100 hover:bg-stone-200 disabled:opacity-50 text-stone-800 font-bold"
                  aria-label="Increase text size"
                >
                  +
                </button>
              </div>
            </div>

            <button type="button" onClick={toggleReduceMotion} className={`${btnBase} w-full ${reduceMotion ? btnOn : btnOff}`}>
              <span aria-hidden="true">&#9632;</span>
              Reduce motion {reduceMotion ? 'ON' : 'OFF'}
            </button>

            <div
              className={`${btnBase} w-full ${speechSupported ? 'border-teal-300 bg-teal-50 text-teal-800' : 'border-stone-200 bg-stone-50 text-stone-400'}`}
              role="status"
            >
              <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 10v2a7 7 0 01-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
              <span className="text-left text-xs sm:text-sm">
                {speechSupported
                  ? 'Voice dictation: use the mic next to text fields (Chrome / Edge / Safari).'
                  : 'Voice dictation is not supported in this browser.'}
              </span>
            </div>

            <button type="button" onClick={resetAll} className={`${btnBase} w-full border-stone-200 bg-stone-50 text-stone-600 hover:bg-stone-100`}>
              Reset all
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowHelp((v) => !v)}
            aria-expanded={showHelp}
            className="mt-4 w-full rounded-lg py-2 text-left text-sm font-semibold text-violet-700 underline hover:bg-violet-50 hover:text-violet-900"
          >
            {showHelp ? 'Hide' : 'Show'} keyboard shortcuts
          </button>

          {showHelp && (
            <div className="mt-3 rounded-xl border border-stone-200 bg-stone-50 p-3">
              <p className="mb-2 text-xs text-stone-600">
                On Mac, <strong>Option + number</strong> often types symbols instead of shortcuts — use{' '}
                <strong>Ctrl + Shift + 1–5</strong> to change pages.
              </p>
              <table className="w-full text-left text-sm">
                <thead>
                  <tr>
                    <th className="pb-1 font-semibold text-stone-700">Keys</th>
                    <th className="pb-1 font-semibold text-stone-700">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {SHORTCUTS.map((s) => (
                    <tr key={s.keys}>
                      <td className="py-1 pr-2 align-top">
                        <kbd className="inline-block rounded border border-stone-300 bg-white px-1.5 py-0.5 text-[10px] font-mono leading-snug sm:text-xs">
                          {s.keys}
                        </kbd>
                      </td>
                      <td className="py-1 text-stone-600">{s.action}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="mt-3 text-xs text-stone-400">
            Press <kbd className="rounded border border-stone-300 bg-white px-1 font-mono">?</kbd> (Shift + /) when not typing in a field to open this panel.
          </p>
        </div>
      )}
    </div>
  );

  const mount = getA11yMount();
  if (!mount) return null;
  return createPortal(content, mount);
}
