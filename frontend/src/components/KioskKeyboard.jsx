const LETTER_ROWS = [
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
  ['z', 'x', 'c', 'v', 'b', 'n', 'm'],
];

const NUMBER_ROW = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];

export default function KioskKeyboard({
  visible,
  activeFieldLabel,
  onKeyPress,
  onDone,
}) {
  const press = (key) => (event) => {
    event.preventDefault();
    onKeyPress(key);
  };

  const renderKey = (key, extraClass = '') => (
    <button
      key={key}
      type="button"
      onPointerDown={press(key)}
      className={`min-h-12 rounded-2xl border border-stone-200 bg-white px-4 text-base font-bold text-stone-800 shadow-sm transition hover:bg-stone-50 active:scale-95 ${extraClass}`}
    >
      {key}
    </button>
  );

  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-50 border-t border-stone-200 bg-white/95 px-4 pb-4 pt-3 shadow-2xl backdrop-blur transition-all duration-300 ${
        visible ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-8 opacity-0'
      }`}
      aria-hidden={!visible}
    >
      <div className="mx-auto max-w-5xl">
        <div className="mb-2 flex items-center justify-between px-1">
          <p className="text-xs font-bold uppercase tracking-wider text-stone-500">
            Typing {activeFieldLabel}
          </p>
          <button
            type="button"
            onPointerDown={(event) => {
              event.preventDefault();
              onDone();
            }}
            className="rounded-full bg-stone-900 px-4 py-2 text-sm font-bold text-white transition hover:bg-stone-700 active:scale-95"
          >
            Done
          </button>
        </div>

        <div className="space-y-2">
          <div className="grid grid-cols-10 gap-2">
            {NUMBER_ROW.map((key) => renderKey(key))}
          </div>

          {LETTER_ROWS.map((row, index) => (
            <div
              key={`letter-row-${index}`}
              className={`grid gap-2 ${index === 0 ? 'grid-cols-10' : index === 1 ? 'grid-cols-9 px-8' : 'grid-cols-7 px-20'}`}
            >
              {row.map((key) => renderKey(key))}
            </div>
          ))}

          <div className="grid grid-cols-12 gap-2">
            {renderKey('@', 'col-span-1')}
            {renderKey('.', 'col-span-1')}
            {renderKey('.com', 'col-span-2')}
            {renderKey('.gmail.com', 'col-span-3')}
            {renderKey('space', 'col-span-2')}
            {renderKey('clear', 'col-span-1')}
            {renderKey('backspace', 'col-span-2')}
          </div>
        </div>
      </div>
    </div>
  );
}
