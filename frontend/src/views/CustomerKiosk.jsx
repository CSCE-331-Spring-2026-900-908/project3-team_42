import { useState, useEffect, useRef, useMemo } from 'react';
import api, { getApiErrorMessage } from '../api';

const KIOSK_CASHIER_ID = 3;

function DrinkPlaceholder() {
  return (
    <svg className="h-16 w-16 text-stone-300" viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <path
        d="M18 14h28l-2 36a4 4 0 01-4 3.8H24a4 4 0 01-4-3.8L18 14z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M22 22h20M22 30h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="32" cy="46" r="3" fill="currentColor" opacity="0.35" />
    </svg>
  );
}

function ChatGlyph() {
  return (
    <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
      />
    </svg>
  );
}

export default function CustomerKiosk() {
  const [menuItems, setMenuItems] = useState([]);
  const [menuLoading, setMenuLoading] = useState(true);
  const [menuError, setMenuError] = useState(null);
  const [cart, setCart] = useState([]);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [language, setLanguage] = useState('en');
  const [isTranslating, setIsTranslating] = useState(false);

  const [chatOpen, setChatOpen] = useState(false);
  const [chatLog, setChatLog] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatting, setIsChatting] = useState(false);
  const chatEndRef = useRef(null);

  const [copy, setCopy] = useState({
    welcome: 'Welcome to Reveille Boba',
    translateBtn: 'Translate to Spanish',
    addToOrder: 'Add to order',
    total: 'Total',
    checkout: 'Pay now',
    yourOrder: 'Your order',
    stepBrowse: 'Browse',
    stepReview: 'Review',
    stepPay: 'Pay',
    emptyCart: 'Tap a drink to start your order',
    assistantHint: 'Ask about ice level, sweetness, or toppings.',
  });

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

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatLog, isChatting]);

  const byCategory = useMemo(() => {
    const map = new Map();
    for (const item of menuItems) {
      const cat = item.category || 'Drinks';
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat).push(item);
    }
    return map;
  }, [menuItems]);

  const translateText = async (text, target) => {
    if (target === 'en') return text;
    try {
      const res = await api.post('/translate', { text, target });
      return res.data.translatedText;
    } catch {
      return text;
    }
  };

  const handleTranslateToggle = async () => {
    if (isTranslating) return;
    setIsTranslating(true);
    const targetLang = language === 'en' ? 'es' : 'en';

    if (targetLang === 'es') {
      try {
        const keys = [
          'welcome',
          'addToOrder',
          'total',
          'checkout',
          'yourOrder',
          'stepBrowse',
          'stepReview',
          'stepPay',
          'emptyCart',
          'assistantHint',
        ];
        const translated = await Promise.all(keys.map((k) => translateText(copy[k], 'es')));
        const nextCopy = keys.reduce((acc, k, i) => ({ ...acc, [k]: translated[i] }), {});
        setCopy((c) => ({ ...c, ...nextCopy, translateBtn: 'Traducir al Inglés' }));

        const translatedMenu = await Promise.all(
          menuItems.map(async (item) => ({
            ...item,
            name: await translateText(item.name, 'es'),
            description: await translateText(item.description ?? '', 'es'),
          }))
        );
        setMenuItems(translatedMenu);
      } catch (err) {
        console.error('Translation failed', err);
      }
    } else {
      try {
        const res = await api.get('/menu');
        setMenuItems(res.data);
      } catch (err) {
        console.error(err);
      }
      setCopy({
        welcome: 'Welcome to Reveille Boba',
        translateBtn: 'Translate to Spanish',
        addToOrder: 'Add to order',
        total: 'Total',
        checkout: 'Pay now',
        yourOrder: 'Your order',
        stepBrowse: 'Browse',
        stepReview: 'Review',
        stepPay: 'Pay',
        emptyCart: 'Tap a drink to start your order',
        assistantHint: 'Ask about ice level, sweetness, or toppings.',
      });
    }

    setLanguage(targetLang);
    setIsTranslating(false);
  };

  const handleChatSubmit = async (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const userMsg = chatInput;
    setChatLog((prev) => [...prev, { sender: 'user', text: userMsg }]);
    setChatInput('');
    setIsChatting(true);

    try {
      const menuContext = menuItems
        .map((i) => `${i.name}: ${i.description ?? ''} ($${i.default_price})`)
        .join('; ');
      const res = await api.post('/chat', { message: userMsg, menuContext, language });
      setChatLog((prev) => [...prev, { sender: 'ai', text: res.data.reply }]);
    } catch {
      setChatLog((prev) => [...prev, { sender: 'ai', text: "Sorry, I'm having trouble connecting." }]);
    } finally {
      setIsChatting(false);
    }
  };

  const addToCart = (item) => {
    setCart((prev) => {
      const i = prev.findIndex((l) => l.id === item.id);
      if (i >= 0) {
        const next = [...prev];
        next[i] = { ...next[i], quantity: next[i].quantity + 1 };
        return next;
      }
      return [...prev, { ...item, unique_id: Date.now(), quantity: 1 }];
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
    setCart((prev) => prev.filter((line) => line.unique_id !== unique_id));
  };

  const cartTotal = cart.reduce((sum, line) => sum + parseFloat(line.default_price) * line.quantity, 0);
  const itemCount = cart.reduce((n, line) => n + line.quantity, 0);

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    setCheckoutLoading(true);
    const total_amount = cartTotal;
    const formattedItems = cart.map((i) => ({
      menu_item_id: i.id,
      quantity: i.quantity,
      customization: null,
      price: i.default_price,
    }));
    try {
      const res = await api.post('/orders', {
        cashier_id: KIOSK_CASHIER_ID,
        total_amount,
        items: formattedItems,
      });
      alert(`${res.data.message} (Order #${res.data.id})`);
      setCart([]);
    } catch (err) {
      const fallback = language === 'es' ? 'No se pudo completar el pago.' : 'Checkout failed. Please try again.';
      alert(getApiErrorMessage(err, fallback));
      console.error(err);
    } finally {
      setCheckoutLoading(false);
    }
  };

  const cartOpen = cart.length > 0;
  const mainPad = cartOpen ? 'pb-[340px] sm:pb-[300px]' : 'pb-36';

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[var(--color-cream)] font-[family-name:var(--font-ui)] grain">
      <header className="relative z-20 border-b border-stone-200/90 bg-white/95 px-5 py-6 backdrop-blur-sm sm:px-10">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="label-caps">Order here</p>
            <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-stone-900 sm:text-[2.1rem]">
              {copy.welcome}
            </h1>
            <div className="mt-5 flex flex-wrap gap-2">
              {[
                { n: 1, label: copy.stepBrowse, active: !cartOpen },
                { n: 2, label: copy.stepReview, active: cartOpen && cartTotal > 0 },
                { n: 3, label: copy.stepPay, active: false },
              ].map((s) => (
                <span
                  key={s.n}
                  className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium ${
                    s.active ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-600'
                  }`}
                >
                  <span className="flex h-5 w-5 items-center justify-center rounded-full border border-current/20 text-[10px]">
                    {s.n}
                  </span>
                  {s.label}
                </span>
              ))}
            </div>
          </div>
          <button
            type="button"
            onClick={handleTranslateToggle}
            disabled={isTranslating}
            className="self-start rounded-xl border border-stone-300 bg-white px-5 py-2.5 text-sm font-medium text-stone-800 shadow-sm transition hover:border-stone-400 hover:bg-stone-50 disabled:opacity-50 lg:self-end"
          >
            {isTranslating ? '…' : copy.translateBtn}
          </button>
        </div>
      </header>

      <main className={`relative z-10 mx-auto max-w-6xl px-5 py-10 sm:px-10 ${mainPad}`}>
        {menuLoading && (
          <p className="mb-8 text-center text-stone-600" role="status">
            Loading menu…
          </p>
        )}
        {menuError && !menuLoading && (
          <div
            className="mb-8 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-center text-red-900"
            role="alert"
          >
            {menuError}
          </div>
        )}
        <div className="space-y-14">
          {!menuLoading && !menuError && menuItems.length === 0 && (
            <p className="text-center text-stone-500">No menu items available.</p>
          )}
          {[...byCategory.entries()].map(([category, items]) => (
            <section key={category}>
              <h2 className="mb-6 font-display text-2xl font-semibold text-stone-900">{category}</h2>
              <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                {items.map((item) => (
                  <article
                    key={item.id}
                    className="surface-card flex flex-col overflow-hidden rounded-xl ring-0 transition hover:shadow-md"
                  >
                    <div className="relative aspect-[4/3] bg-stone-100">
                      {item.image_url ? (
                        <img src={item.image_url} alt={item.name} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full items-center justify-center" aria-hidden="true">
                          <DrinkPlaceholder />
                        </div>
                      )}
                      <span className="absolute left-3 top-3 rounded-md bg-stone-900/85 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-white">
                        {category}
                      </span>
                    </div>
                    <div className="flex flex-1 flex-col p-5">
                      <h3 className="font-display text-lg font-semibold leading-snug text-stone-900">{item.name}</h3>
                      <p className="mt-2 flex-1 text-sm leading-relaxed text-stone-600 line-clamp-3">
                        {item.description ?? ''}
                      </p>
                      <div className="mt-4 flex items-end justify-between gap-4 border-t border-stone-100 pt-4">
                        <p
                          className="font-display text-2xl font-semibold tabular-nums text-stone-900"
                          aria-label={`${parseFloat(item.default_price).toFixed(2)} dollars`}
                        >
                          ${parseFloat(item.default_price).toFixed(2)}
                        </p>
                        <button
                          type="button"
                          onClick={() => addToCart(item)}
                          className="rounded-lg bg-stone-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-stone-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-2"
                          aria-label={`${copy.addToOrder}: ${item.name}`}
                        >
                          {copy.addToOrder}
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      </main>

      {cartOpen && (
        <div
          className="fixed bottom-[120px] left-0 right-0 z-30 max-h-[200px] overflow-y-auto border-t border-stone-200 bg-white/95 px-5 py-4 shadow-[0_-8px_30px_-12px_rgba(0,0,0,0.12)] backdrop-blur-sm sm:bottom-[112px]"
          aria-label={copy.yourOrder}
        >
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 pb-2">
            <p className="font-display text-lg font-semibold text-stone-900">{copy.yourOrder}</p>
            <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold text-stone-700">
              {itemCount} {itemCount === 1 ? 'item' : 'items'}
            </span>
          </div>
          <ul className="mx-auto flex max-w-6xl flex-col gap-2">
            {cart.map((line) => (
              <li
                key={line.unique_id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-stone-200 bg-stone-50/80 px-4 py-3"
              >
                <span className="min-w-0 flex-1 font-medium text-stone-800">
                  {line.name}
                  <span className="ml-2 text-sm font-normal tabular-nums text-stone-500">
                    ${parseFloat(line.default_price).toFixed(2)} × {line.quantity}
                  </span>
                </span>
                <div className="flex items-center gap-2">
                  <div className="flex items-center rounded-lg border border-stone-200 bg-white p-0.5">
                    <button
                      type="button"
                      onClick={() => decrementLine(line.unique_id)}
                      className="flex h-9 w-9 items-center justify-center rounded-md text-lg font-semibold text-stone-600 hover:bg-stone-100"
                      aria-label={language === 'es' ? 'Menos' : 'Decrease'}
                    >
                      −
                    </button>
                    <span className="min-w-[2rem] text-center text-sm font-semibold tabular-nums">{line.quantity}</span>
                    <button
                      type="button"
                      onClick={() => addToCart(line)}
                      className="flex h-9 w-9 items-center justify-center rounded-md text-lg font-semibold text-stone-600 hover:bg-stone-100"
                      aria-label={language === 'es' ? 'Más' : 'Increase'}
                    >
                      +
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeLine(line.unique_id)}
                    className="rounded-md p-2 text-stone-400 hover:bg-red-50 hover:text-red-700"
                    aria-label={language === 'es' ? 'Eliminar' : 'Remove'}
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
              </li>
            ))}
          </ul>
        </div>
      )}

      {!cartOpen && (
        <p className="pointer-events-none fixed bottom-32 left-0 right-0 z-10 text-center text-sm text-stone-500">
          {copy.emptyCart}
        </p>
      )}

      <div
        className={`fixed bottom-28 right-6 z-40 flex flex-col items-end gap-3 sm:bottom-32 sm:right-10 ${
          chatOpen ? 'pointer-events-none opacity-0' : ''
        }`}
      >
        <button
          type="button"
          onClick={() => setChatOpen(true)}
          className="flex h-14 w-14 items-center justify-center rounded-2xl bg-stone-900 text-white shadow-lg shadow-stone-900/20 transition hover:bg-stone-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-2"
          aria-label="Open menu assistant"
        >
          <ChatGlyph />
        </button>
      </div>

      <div
        className={`fixed bottom-28 right-6 z-50 w-[min(100vw-2rem,420px)] origin-bottom-right transition sm:bottom-32 sm:right-10 ${
          chatOpen ? 'scale-100 opacity-100' : 'pointer-events-none scale-95 opacity-0'
        }`}
      >
        <div className="surface-card flex max-h-[min(70vh,520px)] flex-col overflow-hidden rounded-2xl p-0 shadow-xl">
          <div className="flex items-center justify-between border-b border-stone-200 bg-stone-900 px-4 py-3.5 text-white">
            <span className="font-display text-base font-semibold">Menu help</span>
            <button
              type="button"
              onClick={() => setChatOpen(false)}
              className="rounded-lg p-2 text-white/80 hover:bg-white/10 hover:text-white"
              aria-label="Close assistant"
            >
              <span className="sr-only">Close</span>
              <span aria-hidden="true">×</span>
            </button>
          </div>
          <div className="max-h-72 space-y-3 overflow-y-auto bg-stone-50 p-4">
            {chatLog.length === 0 && (
              <p className="text-center text-sm leading-relaxed text-stone-600">{copy.assistantHint}</p>
            )}
            {chatLog.map((msg, i) => (
              <div
                key={i}
                className={`max-w-[92%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed ${
                  msg.sender === 'user'
                    ? 'ml-auto bg-stone-800 text-white'
                    : 'border border-stone-200 bg-white text-stone-800'
                }`}
              >
                <span className="whitespace-pre-wrap break-words">{msg.text}</span>
              </div>
            ))}
            {isChatting && <p className="text-sm text-stone-500">…</p>}
            <div ref={chatEndRef} />
          </div>
          <form onSubmit={handleChatSubmit} className="flex gap-2 border-t border-stone-200 bg-white p-3">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              className="min-h-[48px] flex-1 rounded-xl border border-stone-200 bg-stone-50 px-4 text-base text-stone-900 outline-none placeholder:text-stone-400 focus:ring-2 focus:ring-stone-400"
              placeholder={language === 'es' ? 'Pregunta sobre el menú…' : 'Ask about the menu…'}
            />
            <button
              type="submit"
              disabled={isChatting}
              className="rounded-xl bg-stone-900 px-4 text-sm font-semibold text-white hover:bg-stone-800 disabled:opacity-50"
            >
              {language === 'es' ? 'Enviar' : 'Send'}
            </button>
          </form>
        </div>
      </div>

      <footer className="fixed bottom-0 left-0 right-0 z-30 border-t border-stone-200 bg-white/95 px-5 py-5 backdrop-blur-md sm:px-10">
        <div className="mx-auto flex max-w-6xl flex-col items-stretch gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div aria-live="polite" aria-atomic="true">
            <p className="label-caps">{copy.total}</p>
            <p className="font-display text-4xl font-semibold tabular-nums text-stone-900 sm:text-[2.75rem]">
              ${cartTotal.toFixed(2)}
            </p>
          </div>
          <button
            type="button"
            onClick={handleCheckout}
            disabled={cart.length === 0 || checkoutLoading}
            className="min-h-[52px] rounded-xl bg-stone-900 px-10 py-3.5 text-lg font-semibold text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-40 sm:min-w-[220px] sm:text-xl"
            aria-label={copy.checkout}
          >
            {checkoutLoading ? '…' : copy.checkout}
          </button>
        </div>
      </footer>
    </div>
  );
}
