export default function Modal({ open, title, onClose, children }) {
  if (!open) return null;

  return (
    <div
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

