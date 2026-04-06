import { useMemo, useState, useEffect } from 'react';
import api from '../api';

export default function Cashier() {
  const [menuItems, setMenuItems] = useState([]);
  const [cart, setCart] = useState([]);
  const cashierId = 2;

  useEffect(() => {
    api.get('/menu').then((res) => setMenuItems(res.data)).catch(console.error);
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
      alert('Checkout failed: ' + err.message);
    }
  };

  const total = cart.reduce((sum, item) => sum + parseFloat(item.default_price) * item.quantity, 0);
  const itemCount = cart.reduce((n, item) => n + item.quantity, 0);

  return (
    <div className="flex min-h-screen flex-col bg-[#f0fdfa] font-[family-name:var(--font-ui)] lg:flex-row">
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <div id="main-content" className="flex min-h-0 flex-1 flex-col lg:min-h-screen">
        <header className="sticky top-0 z-20 border-b border-teal-200/80 bg-[#f0fdfa]/90 px-6 py-5 backdrop-blur-md">
          <div className="mx-auto flex max-w-[1600px] flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-teal-700">Cashier station</p>
              <h1 className="font-display text-2xl font-bold text-teal-950">Tap drinks · Review cart · Checkout</h1>
            </div>
            <ol className="flex gap-4 text-sm text-teal-800/90">
              <li className="flex items-center gap-2">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-teal-600 text-xs font-bold text-white">
                  1
                </span>
                Add items
              </li>
              <li className="flex items-center gap-2">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-teal-100 text-xs font-bold text-teal-800">
                  2
                </span>
                Confirm
              </li>
              <li className="flex items-center gap-2">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-teal-100 text-xs font-bold text-teal-800">
                  3
                </span>
                Send order
              </li>
            </ol>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-8 pb-28 sm:px-8">
          <div className="mx-auto max-w-[1600px] space-y-10">
            {[...byCategory.entries()].map(([category, items]) => (
              <section key={category}>
                <h2 className="mb-4 font-display text-lg font-semibold text-teal-900">{category}</h2>
                <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-4">
                  {items.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => addToCart(item)}
                      aria-label={`Add ${item.name} to cart — $${parseFloat(item.default_price).toFixed(2)}`}
                      className="group flex min-h-[140px] flex-col items-center justify-center rounded-2xl border border-teal-100 bg-white p-5 text-center shadow-sm ring-teal-400/0 transition hover:border-teal-300 hover:shadow-md hover:ring-2 hover:ring-teal-400/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 active:scale-[0.98]"
                    >
                      <span className="text-lg font-bold leading-snug text-stone-800 group-hover:text-teal-900">
                        {item.name}
                      </span>
                      <span className="mt-3 rounded-full bg-teal-50 px-4 py-1 text-base font-semibold tabular-nums text-teal-800">
                        ${parseFloat(item.default_price).toFixed(2)}
                      </span>
                      <span className="mt-2 text-xs font-medium text-teal-600/80">
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

      <aside id="cart-region" tabIndex={-1} className="flex max-h-[55vh] w-full shrink-0 flex-col border-t border-teal-200/90 bg-white shadow-[0_-8px_32px_-12px_rgba(15,118,110,0.2)] lg:max-h-none lg:max-w-md lg:border-l lg:border-t-0 lg:shadow-[-8px_0_32px_-12px_rgba(15,118,110,0.25)]">
        <div className="flex items-center justify-between bg-gradient-to-r from-teal-800 to-teal-700 px-6 py-5 text-white">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-teal-100/90">Current order</p>
            <p className="font-display text-xl font-bold">Cart</p>
          </div>
          <span className="rounded-full bg-white/15 px-3 py-1 text-sm font-bold tabular-nums ring-1 ring-white/20">
            {itemCount} {itemCount === 1 ? 'drink' : 'drinks'}
          </span>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-stone-50/80 p-4">
          {cart.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center text-stone-400">
              <div className="mb-4 rounded-2xl bg-teal-50 p-6 text-teal-300">
                <svg className="mx-auto h-14 w-14" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
                  />
                </svg>
              </div>
              <p className="font-medium text-stone-500">Cart is empty</p>
              <p className="mt-1 text-sm text-stone-400">Tap menu tiles to add drinks</p>
            </div>
          )}
          {cart.map((item) => (
            <div
              key={item.unique_id}
              className="flex items-center gap-3 rounded-xl border border-stone-100 bg-white p-4 shadow-sm"
            >
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-stone-800">{item.name}</p>
                <p className="mt-0.5 text-sm tabular-nums text-teal-700">
                  ${parseFloat(item.default_price).toFixed(2)} each
                </p>
              </div>
              <div className="flex items-center gap-1 rounded-xl bg-stone-100 p-1">
                <button
                  type="button"
                  onClick={() => decrementLine(item.unique_id)}
                  className="flex h-12 w-12 items-center justify-center rounded-lg text-lg font-bold text-stone-600 transition hover:bg-white hover:text-teal-800"
                  aria-label="Decrease quantity"
                >
                  −
                </button>
                <span className="min-w-[2rem] text-center text-base font-bold tabular-nums text-stone-900">
                  {item.quantity}
                </span>
                <button
                  type="button"
                  onClick={() => addToCart(item)}
                  className="flex h-12 w-12 items-center justify-center rounded-lg text-lg font-bold text-stone-600 transition hover:bg-white hover:text-teal-800"
                  aria-label="Increase quantity"
                >
                  +
                </button>
              </div>
              <button
                type="button"
                onClick={() => removeLine(item.unique_id)}
                className="flex h-12 w-12 items-center justify-center rounded-lg text-stone-400 transition hover:bg-red-50 hover:text-red-600"
                aria-label="Remove line"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          ))}
        </div>

        <div className="border-t border-stone-200 bg-white p-6">
          <div className="mb-5 flex items-end justify-between">
            <span className="text-sm font-medium uppercase tracking-wide text-stone-500">Total</span>
            <span className="font-display text-4xl font-bold tabular-nums text-teal-900">${total.toFixed(2)}</span>
          </div>
          <button
            id="checkout-btn"
            type="button"
            onClick={handleCheckout}
            disabled={cart.length === 0}
            className="w-full rounded-2xl bg-gradient-to-r from-teal-600 to-emerald-600 py-4 text-lg font-bold text-white shadow-lg shadow-teal-900/20 transition hover:from-teal-500 hover:to-emerald-500 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
          >
            Complete sale
          </button>
        </div>
      </aside>
    </div>
  );
}
