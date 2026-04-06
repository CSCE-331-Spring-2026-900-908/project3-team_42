import { useEffect, useRef, useCallback } from 'react';

export default function Modal({ open, title, onClose, children }) {
  const dialogRef = useRef(null);
  const previousFocus = useRef(null);

  const getFocusable = useCallback(() => {
    if (!dialogRef.current) return [];
    return Array.from(
      dialogRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
    );
  }, []);

  useEffect(() => {
    if (!open) return;

    previousFocus.current = document.activeElement;

    const timer = requestAnimationFrame(() => {
      const els = getFocusable();
      if (els.length > 0) els[0].focus();
    });

    const onKeyDown = (e) => {
      if (e.key === 'Escape') { onClose?.(); return; }

      if (e.key === 'Tab') {
        const els = getFocusable();
        if (els.length === 0) return;
        const first = els[0];
        const last = els[els.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      cancelAnimationFrame(timer);
      window.removeEventListener('keydown', onKeyDown);
      previousFocus.current?.focus();
    };
  }, [open, onClose, getFocusable]);

  if (!open) return null;

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-[999] flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div className="w-full max-w-5xl overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-black/5">
        <div className="flex items-center justify-between gap-3 border-b border-stone-200 px-5 py-4">
          <h3 className="font-display text-lg font-bold text-stone-900">{title}</h3>
          <button
            type="button"
            onClick={() => onClose?.()}
            className="min-h-[44px] rounded-xl border border-stone-200 bg-white px-4 py-2 text-sm font-bold text-stone-700 transition hover:bg-stone-50"
            aria-label="Close modal"
          >
            Close
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

