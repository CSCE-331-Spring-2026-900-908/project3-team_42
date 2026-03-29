import { useMemo, useState, useEffect } from 'react';
import api, { getApiErrorMessage } from '../api';

export default function Cashier() {
  const [menuItems, setMenuItems] = useState([]);
  const [menuLoading, setMenuLoading] = useState(true);
  const [menuError, setMenuError] = useState(null);
  const [cart, setCart] = useState([]);
  const cashierId = 2;

  useEffect(() => {
    let cancelled = false;
    api
      .get('/menu')
      .then((res) => {
        if (!cancelled) {
          setMenuItems(res.data);
          setMenuError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) setMenuError(getApiErrorMessage(err, 'Could not load menu.'));
      })
      .finally(() => {
        if (!cancelled) setMenuLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const byCategory = useMemo(() => {
    const map = new Map();
    for (const item of menuItems) {
      const cat = item.category || 'Menu';
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat).push(item);
    }
    return map;
  }, [menuItems]);

  const addToCart = (item) => {
    setCart((prev) => {
      const i = prev.findIndex((l) => l.id === item.id);
      if (i >= 0) {
        const next = [...prev];
        next[i] = { ...next[i], quantity: next[i].quantity + 1 };
        return next;
      }
      return [...prev, { ...item, unique_id: Date.now(), quantity: 1, customization: null }];
    });
  };

  const decrementLine = (unique_id) => {
    setCart((prev) =>
      prev.flatMap((line) => {
        if (line.unique_id !== unique_id) return [line];
        if (line.quantity <= 1) return [];
        return [{ ...line, quantity: line.quantity - 1 }];
      })
    );
  };

  const removeLine = (unique_id) => {
    setCart((prev) => prev.filter((item) => item.unique_id !== unique_id));
  };

  const handleCheckout = async () => {
    if (cart.length === 0) return;

    const total_amount = cart.reduce((sum, item) => sum + parseFloat(item.default_price) * item.quantity, 0);

    try {
      const formattedItems = cart.map((i) => ({
        menu_item_id: i.id,
        quantity: i.quantity,
        customization: i.customization,
        price: i.default_price,
      }));

      const res = await api.post('/orders', {
        cashier_id: cashierId,
        total_amount,
        items: formattedItems,
      });

      alert(res.data.message + ` (Order #${res.data.id})`);
      setCart([]);
    } catch (err) {
      alert(`Checkout failed: ${getApiErrorMessage(err, 'Please try again.')}`);
    }
  };

  const total = cart.reduce((sum, item) => sum + parseFloat(item.default_price) * item.quantity, 0);
  const itemCount = cart.reduce((n, item) => n + item.quantity, 0);

  return (
    <div className="flex min-h-screen flex-col bg-stone-100 font-[family-name:var(--font-ui)] grain lg:flex-row">
      <div className="flex min-h-0 flex-1 flex-col lg:min-h-screen">
        <header className="sticky top-0 z-20 border-b border-stone-200 bg-white/95 px-6 py-5 backdrop-blur-sm">
          <div className="mx-auto flex max-w-[1600px] flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="label-caps">Register</p>
              <h1 className="font-display text-2xl font-semibold text-stone-900">Tap items · review cart · send</h1>
            </div>
            <ol className="flex gap-4 text-sm text-stone-600">
              <li className="flex items-center gap-2">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-stone-900 text-xs font-semibold text-white">
                  1
                </span>
                Add
              </li>
              <li className="flex items-center gap-2">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-stone-300 text-xs font-semibold text-stone-700">
                  2
                </span>
                Confirm
              </li>
              <li className="flex items-center gap-2">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-stone-300 text-xs font-semibold text-stone-700">
                  3
                </span>
                Send
              </li>
            </ol>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-8 pb-28 sm:px-8">
          <div className="mx-auto max-w-[1600px] space-y-10">
            {menuLoading && (
              <p className="text-center text-lg font-medium text-stone-600" role="status">
                Loading menu…
              </p>
            )}
            {menuError && !menuLoading && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-center text-red-900" role="alert">
                {menuError}
              </div>
            )}
            {!menuLoading && !menuError && menuItems.length === 0 && (
              <p className="text-center text-stone-500">No menu items available.</p>
            )}
            {[...byCategory.entries()].map(([category, items]) => (
              <section key={category}>
                <h2 className="mb-4 font-display text-lg font-semibold text-stone-900">{category}</h2>
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-4">
                  {items.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => addToCart(item)}
                      className="surface-card group flex min-h-[132px] flex-col items-center justify-center rounded-xl p-4 text-center transition hover:border-stone-300 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-2 active:scale-[0.99]"
                    >
                      <span className="text-base font-semibold leading-snug text-stone-900">{item.name}</span>
                      <span className="mt-3 rounded-md bg-stone-100 px-3 py-1 text-sm font-semibold tabular-nums text-stone-800">
                        ${parseFloat(item.default_price).toFixed(2)}
                      </span>
                      <span className="mt-2 text-[11px] font-medium text-stone-500 opacity-0 transition group-hover:opacity-100">
                        Tap again for +1
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      </div>

      <aside className="flex max-h-[55vh] w-full shrink-0 flex-col border-t border-stone-200 bg-white shadow-[0_-8px_32px_-12px_rgba(0,0,0,0.08)] lg:max-h-none lg:max-w-md lg:border-l lg:border-t-0 lg:shadow-[-8px_0_24px_-12px_rgba(0,0,0,0.06)]">
        <div className="flex items-center justify-between border-b border-stone-200 bg-stone-900 px-5 py-4 text-white">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-stone-400">Current order</p>
            <p className="font-display text-lg font-semibold">Cart</p>
          </div>
          <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold tabular-nums text-white">
            {itemCount} {itemCount === 1 ? 'drink' : 'drinks'}
          </span>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-stone-50 p-4">
          {cart.length === 0 && (
            <div className="flex flex-col items-center justify-center py-14 text-center text-stone-400">
              <div className="mb-3 rounded-xl border border-dashed border-stone-300 p-6 text-stone-300">
                <svg className="mx-auto h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
                  />
                </svg>
              </div>
              <p className="font-medium text-stone-600">Empty cart</p>
              <p className="mt-1 text-sm text-stone-500">Tap a tile to add</p>
            </div>
          )}
          {cart.map((item) => (
            <div
              key={item.unique_id}
              className="surface-card flex items-center gap-3 rounded-xl border-stone-200 p-3.5"
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium text-stone-900">{item.name}</p>
                <p className="mt-0.5 text-sm tabular-nums text-stone-600">
                  ${parseFloat(item.default_price).toFixed(2)} each
                </p>
              </div>
              <div className="flex items-center gap-0.5 rounded-lg border border-stone-200 bg-white p-0.5">
                <button
                  type="button"
                  onClick={() => decrementLine(item.unique_id)}
                  className="flex h-9 w-9 items-center justify-center rounded-md text-lg font-semibold text-stone-600 hover:bg-stone-100"
                  aria-label="Decrease quantity"
                >
                  −
                </button>
                <span className="min-w-[2rem] text-center text-sm font-semibold tabular-nums text-stone-900">
                  {item.quantity}
                </span>
                <button
                  type="button"
                  onClick={() => addToCart(item)}
                  className="flex h-9 w-9 items-center justify-center rounded-md text-lg font-semibold text-stone-600 hover:bg-stone-100"
                  aria-label="Increase quantity"
                >
                  +
                </button>
              </div>
              <button
                type="button"
                onClick={() => removeLine(item.unique_id)}
                className="rounded-md p-2 text-stone-400 hover:bg-red-50 hover:text-red-700"
                aria-label="Remove line"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </button>
            </div>
          ))}
        </div>

        <div className="border-t border-stone-200 bg-white p-5">
          <div className="mb-4 flex items-end justify-between">
            <span className="label-caps">Total</span>
            <span className="font-display text-3xl font-semibold tabular-nums text-stone-900">${total.toFixed(2)}</span>
          </div>
          <button
            type="button"
            onClick={handleCheckout}
            disabled={cart.length === 0}
            className="w-full rounded-xl bg-stone-900 py-3.5 text-base font-semibold text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Complete sale
          </button>
        </div>
      </aside>
    </div>
  );
}
