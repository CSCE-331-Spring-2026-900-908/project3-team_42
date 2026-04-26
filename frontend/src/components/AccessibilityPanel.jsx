import { useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useAccessibility } from '../context/AccessibilityContext';

const FONT_LABELS = ['100%', '125%', '150%'];

function getA11yMount() {
  if (typeof document === 'undefined') return null;
  return document.getElementById('a11y-root') ?? document.body;
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
  const triggerRef = useRef(null);

  const closePanel = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  const btnBase =
    'flex min-h-[44px] items-center gap-2 rounded-xl border-2 px-3 py-2 text-sm font-semibold transition-colors';
  const btnOn = 'border-violet-600 bg-violet-50 text-violet-800';
  const btnOff = 'border-stone-300 bg-white text-stone-700 hover:bg-stone-50';

  const content = (
    <div className="a11y-ui">
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
          role="dialog"
          aria-modal="false"
          aria-label="Accessibility settings"
          className="pointer-events-auto fixed left-6 bottom-24 z-[1] max-h-[min(calc(100vh-7rem),560px)] w-[min(92vw,360px)] overflow-y-auto rounded-2xl border-2 border-stone-300 bg-white p-5 shadow-2xl"
        >
          <div className="mb-4 flex items-center justify-between gap-2">
            <h2 className="text-lg font-bold text-stone-900">Accessibility</h2>
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

          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={toggleHighContrast}
              className={`${btnBase} w-full ${highContrast ? btnOn : btnOff}`}
              aria-pressed={highContrast}
            >
              <span aria-hidden="true">◐</span>
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
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-stone-300 bg-stone-100 hover:bg-stone-200 disabled:opacity-50 text-stone-800 font-bold"
                  aria-label="Decrease text size"
                >
                  −
                </button>
                <button
                  type="button"
                  onClick={increaseFontSize}
                  disabled={fontSizeIndex === FONT_LABELS.length - 1}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-stone-300 bg-stone-100 hover:bg-stone-200 disabled:opacity-50 text-stone-800 font-bold"
                  aria-label="Increase text size"
                >
                  +
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={toggleReduceMotion}
              className={`${btnBase} w-full ${reduceMotion ? btnOn : btnOff}`}
              aria-pressed={reduceMotion}
            >
              <span aria-hidden="true">▪</span>
              Reduce motion {reduceMotion ? 'ON' : 'OFF'}
            </button>

            <button
              type="button"
              onClick={resetAll}
              className={`${btnBase} w-full border-stone-200 bg-stone-50 text-stone-600 hover:bg-stone-100`}
            >
              Reset all
            </button>
          </div>
        </div>
      )}
    </div>
  );

  const mount = getA11yMount();
  if (!mount) return null;
  return createPortal(content, mount);
}
