import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import api, { CUSTOMER_SESSION_STORAGE_KEY } from '../api';
import VoiceDictationButton from '../components/VoiceDictationButton';

const KIOSK_CASHIER_ID = 3;

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

function firstNameFromUser(user) {
  if (!user) return '';
  const n = (user.name || '').trim();
  if (n) return n.split(/\s+/)[0];
  const local = (user.email || '').split('@')[0];
  return local || '';
}

function defaultKioskCopy() {
  return {
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
    assistantHint: 'Ask about flavors, ice, or toppings',
    signInTitle: 'Sign in to order',
    signInHint: 'Use your Google account for a secure, personalized kiosk session.',
    signInUnavailable: 'Google sign-in is unavailable on this kiosk right now.',
    continueGuest: 'Continue as guest',
    guestHint: 'Guest checkout is available. You can still place an order without signing in.',
    signOut: 'Sign out',
    endSession: 'End session',
    signedInAs: 'Signed in',
    orderSuccessTitle: "You're all set!",
    orderSuccessLead: 'Your order was placed successfully.',
    orderSuccessThankYou: 'Thank you',
    orderSuccessOrderLabel: 'Order number',
    orderSuccessCta: 'Start new order',
  };
}

export default function CustomerKiosk() {
  const [sessionUser, setSessionUser] = useState(null);
  const [sessionLoading, setSessionLoading] = useState(true);

  const [menuItems, setMenuItems] = useState([]);
  const [cart, setCart] = useState([]);
  const [orderSuccess, setOrderSuccess] = useState(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const orderSuccessCtaRef = useRef(null);
  const [language, setLanguage] = useState('en');
  const [isTranslating, setIsTranslating] = useState(false);

  const [chatOpen, setChatOpen] = useState(false);
  const [chatLog, setChatLog] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatting, setIsChatting] = useState(false);
  const chatEndRef = useRef(null);
  const chatPanelRef = useRef(null);

  const [copy, setCopy] = useState(() => defaultKioskCopy());
  const googleSignInAvailable = Boolean(googleClientId);

  useEffect(() => {
    const token = localStorage.getItem(CUSTOMER_SESSION_STORAGE_KEY);
    if (!token) {
      setSessionLoading(false);
      return;
    }
    api
      .get('/auth/me')
      .then((res) => setSessionUser(res.data.user))
      .catch(() => {
        localStorage.removeItem(CUSTOMER_SESSION_STORAGE_KEY);
        setSessionUser(null);
      })
      .finally(() => setSessionLoading(false));
  }, []);

  useEffect(() => {
    if (!sessionUser) return;
    api.get('/menu').then((res) => setMenuItems(res.data)).catch(console.error);
  }, [sessionUser]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatLog, isChatting]);

  useEffect(() => {
    if (!orderSuccess) return;
    orderSuccessCtaRef.current?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') setOrderSuccess(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [orderSuccess]);

  useEffect(() => {
    if (!orderSuccess) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [orderSuccess]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && chatOpen) setChatOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [chatOpen]);

  const getChatFocusable = useCallback(() => {
    if (!chatPanelRef.current) return [];
    return Array.from(
      chatPanelRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
    );
  }, []);

  useEffect(() => {
    if (!chatOpen) return;
    const trap = (e) => {
      if (e.key !== 'Tab') return;
      const els = getChatFocusable();
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
    };
    window.addEventListener('keydown', trap);
    return () => window.removeEventListener('keydown', trap);
  }, [chatOpen, getChatFocusable]);

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

  const handleGoogleSuccess = async (credentialResponse) => {
    try {
      const res = await api.post('/auth/google', { credential: credentialResponse.credential });
      localStorage.setItem(CUSTOMER_SESSION_STORAGE_KEY, res.data.token);
      setSessionUser(res.data.user);
    } catch (err) {
      console.error(err);
      alert('Sign-in failed. Please try again.');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem(CUSTOMER_SESSION_STORAGE_KEY);
    setSessionUser(null);
    setCart([]);
    setMenuItems([]);
    setOrderSuccess(null);
    setLanguage('en');
    setCopy(defaultKioskCopy());
  };

  const handleContinueAsGuest = () => {
    localStorage.removeItem(CUSTOMER_SESSION_STORAGE_KEY);
    setSessionUser({ isGuest: true, name: 'Guest' });
    setCart([]);
    setOrderSuccess(null);
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
          'orderSuccessTitle',
          'orderSuccessLead',
          'orderSuccessThankYou',
          'orderSuccessOrderLabel',
          'orderSuccessCta',
        ];
        const translated = await Promise.all(keys.map((k) => translateText(copy[k], 'es')));
        const nextCopy = keys.reduce((acc, k, i) => ({ ...acc, [k]: translated[i] }), {});
        setCopy((c) => ({ ...c, ...nextCopy, translateBtn: 'Traducir al Inglés' }));

        const translatedMenu = await Promise.all(
          menuItems.map(async (item) => ({
            ...item,
            name: await translateText(item.name, 'es'),
            description: await translateText(item.description, 'es'),
          }))
        );
        setMenuItems(translatedMenu);
      } catch (err) {
        console.error('Translation failed', err);
      }
    } else {
      const res = await api.get('/menu');
      setMenuItems(res.data);
      setCopy(defaultKioskCopy());
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
      const menuContext = menuItems.map((i) => `${i.name}: ${i.description} ($${i.default_price})`).join('; ');
      const res = await api.post('/chat', { message: userMsg, menuContext, language });
      setChatLog((prev) => [...prev, { sender: 'ai', text: res.data.reply }]);
    } catch {
      setChatLog((prev) => [...prev, { sender: 'ai', text: "Sorry, I'm having trouble connecting." }]);
    }
    setIsChatting(false);
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
        placed_via: 'customer_kiosk',
      });
      setOrderSuccess({ orderId: res.data.id });
      setCart([]);
    } catch (err) {
      const status = err.response?.status;
      const target = language === 'es' ? 'es' : 'en';
      if (status === 401) {
        localStorage.removeItem(CUSTOMER_SESSION_STORAGE_KEY);
        setSessionUser(null);
        const text = await translateText(
          'Your session expired. Please sign in again to complete checkout.',
          target
        );
        alert(text);
      } else {
        const text = await translateText('Checkout failed. Please try again.', target);
        alert(text);
      }
      console.error(err);
    }
    setCheckoutLoading(false);
  };

  const cartOpen = cart.length > 0;
  const mainPad = cartOpen ? 'pb-[340px] sm:pb-[300px]' : 'pb-36';

  if (sessionLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-violet-50 to-white font-[family-name:var(--font-ui)]">
        <p className="text-lg font-semibold text-violet-800" role="status">
          Loading…
        </p>
      </div>
    );
  }

  if (!sessionUser) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-violet-100/80 via-fuchsia-50/40 to-white font-[family-name:var(--font-ui)] px-5 py-16">
        <main className="mx-auto flex max-w-lg flex-col items-center rounded-3xl border border-violet-200/80 bg-white/90 p-10 shadow-xl shadow-violet-900/10 backdrop-blur-md">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-600">Customer kiosk</p>
          <h1 className="mt-3 text-center font-display text-3xl font-bold text-violet-950">{copy.signInTitle}</h1>
          <p className="mt-4 text-center text-stone-600">{copy.signInHint}</p>
          <div className="mt-10 flex flex-col items-center gap-4">
            {googleSignInAvailable ? (
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={() => alert('Google sign-in was cancelled or failed.')}
                text="signin_with"
                shape="pill"
                size="large"
                theme="filled_blue"
              />
            ) : (
              <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-center text-sm text-amber-900">
                {copy.signInUnavailable}
              </p>
            )}
            <button
              type="button"
              onClick={handleContinueAsGuest}
              className="min-h-[48px] rounded-2xl border border-violet-200 bg-white px-6 py-3 text-sm font-semibold text-violet-900 shadow-sm transition hover:bg-violet-50"
            >
              {copy.continueGuest}
            </button>
            <p className="max-w-sm text-center text-xs text-stone-500">{copy.guestHint}</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-gradient-to-b from-violet-50 via-fuchsia-50/40 to-white font-[family-name:var(--font-ui)]">
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-violet-200/40 to-transparent"
        aria-hidden="true"
      />

      <header className="relative z-20 border-b border-violet-100/80 bg-white/75 px-5 py-6 backdrop-blur-md sm:px-10">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-600">Self-service</p>
            <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-violet-950 sm:text-4xl">
              {copy.welcome}
            </h1>
            <div className="mt-4 flex flex-wrap gap-2">
              {[
                { n: 1, label: copy.stepBrowse, active: !cartOpen },
                { n: 2, label: copy.stepReview, active: cartOpen && cartTotal > 0 },
                { n: 3, label: copy.stepPay, active: false },
              ].map((s) => (
                <span
                  key={s.n}
                  className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${
                    s.active ? 'bg-violet-600 text-white shadow-md shadow-violet-600/25' : 'bg-violet-100/80 text-violet-800'
                  }`}
                >
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/20 text-[10px]">{s.n}</span>
                  {s.label}
                </span>
              ))}
            </div>
          </div>
          <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-end">
            <div className="flex items-center gap-3 rounded-2xl border border-violet-100 bg-violet-50/80 px-3 py-2 sm:max-w-xs">
              {sessionUser.pictureUrl ? (
                <img
                  src={sessionUser.pictureUrl}
                  alt=""
                  className="h-10 w-10 shrink-0 rounded-full border border-violet-200 object-cover"
                />
              ) : (
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-200 text-sm font-bold text-violet-800">
                  {(sessionUser.name || sessionUser.email || '?').slice(0, 1).toUpperCase()}
                </span>
              )}
              <div className="min-w-0">
                <p className="text-xs font-medium text-violet-700">{copy.signedInAs}</p>
                <p className="truncate text-sm font-semibold text-violet-950" title={sessionUser.email}>
                  {sessionUser.name || sessionUser.email}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-2xl border border-violet-200 bg-white px-4 py-3 text-sm font-semibold text-violet-900 shadow-sm transition hover:bg-violet-50"
            >
              {sessionUser.isGuest ? copy.endSession : copy.signOut}
            </button>
            <button
              type="button"
              onClick={handleTranslateToggle}
              disabled={isTranslating}
              className="rounded-2xl border-2 border-violet-200 bg-white px-6 py-3 text-base font-semibold text-violet-900 shadow-sm transition hover:border-violet-300 hover:bg-violet-50 disabled:opacity-50"
            >
              {isTranslating ? '…' : copy.translateBtn}
            </button>
          </div>
        </div>
      </header>

      <main id="main-content" className={`relative z-10 mx-auto max-w-6xl px-5 py-10 sm:px-10 ${mainPad}`}>
        <div className="space-y-14">
          {[...byCategory.entries()].map(([category, items]) => (
            <section key={category}>
              <h2 className="mb-6 font-display text-2xl font-bold text-violet-950">{category}</h2>
              <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                {items.map((item) => (
                  <article
                    key={item.id}
                    className="flex flex-col overflow-hidden rounded-3xl border border-violet-100/90 bg-white shadow-[0_8px_30px_-12px_rgba(91,33,182,0.2)] ring-1 ring-violet-100/50"
                  >
                    <div className="relative aspect-[4/3] bg-gradient-to-br from-violet-100 to-fuchsia-50">
                      {item.image_url ? (
                        <img
                          src={item.image_url}
                          alt={item.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-6xl opacity-30" aria-hidden="true">
                          🧋
                        </div>
                      )}
                      <span className="absolute left-4 top-4 rounded-full bg-black/50 px-3 py-1 text-xs font-semibold text-white backdrop-blur-sm">
                        {category}
                      </span>
                    </div>
                    <div className="flex flex-1 flex-col p-6">
                      <h3 className="font-display text-xl font-bold leading-snug text-violet-950">{item.name}</h3>
                      <p className="mt-2 flex-1 text-sm leading-relaxed text-stone-600 line-clamp-3">{item.description}</p>
                      <div className="mt-4 flex items-end justify-between gap-4 border-t border-violet-100 pt-4">
                        <p
                          className="font-display text-2xl font-bold tabular-nums text-violet-900"
                          aria-label={`${parseFloat(item.default_price).toFixed(2)} dollars`}
                        >
                          ${parseFloat(item.default_price).toFixed(2)}
                        </p>
                        <button
                          type="button"
                          onClick={() => addToCart(item)}
                          className="rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-6 py-3 text-base font-bold text-white shadow-lg shadow-violet-600/25 transition hover:from-violet-500 hover:to-fuchsia-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
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
          id="cart-region"
          tabIndex={-1}
          className="fixed bottom-[120px] left-0 right-0 z-30 max-h-[200px] overflow-y-auto border-t border-violet-200/80 bg-white/90 px-5 py-4 shadow-[0_-12px_40px_-16px_rgba(91,33,182,0.25)] backdrop-blur-md sm:bottom-[112px]"
          aria-label={copy.yourOrder}
        >
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 pb-2">
            <p className="font-display text-lg font-bold text-violet-950">{copy.yourOrder}</p>
            <span className="rounded-full bg-violet-100 px-3 py-1 text-sm font-bold text-violet-800">
              {itemCount} {itemCount === 1 ? 'item' : 'items'}
            </span>
          </div>
          <ul className="mx-auto flex max-w-6xl flex-col gap-2">
            {cart.map((line) => (
              <li
                key={line.unique_id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-violet-100 bg-violet-50/50 px-4 py-3"
              >
                <span className="min-w-0 flex-1 font-semibold text-stone-800">
                  {line.name}
                  <span className="ml-2 text-sm font-normal tabular-nums text-stone-500">
                    ${parseFloat(line.default_price).toFixed(2)} × {line.quantity}
                  </span>
                </span>
                <div className="flex items-center gap-2">
                  <div className="flex items-center rounded-xl bg-white p-1 shadow-sm ring-1 ring-violet-100">
                    <button
                      type="button"
                      onClick={() => decrementLine(line.unique_id)}
                      className="flex h-12 w-12 items-center justify-center rounded-lg text-lg font-bold text-violet-700 hover:bg-violet-50"
                      aria-label={language === 'es' ? 'Menos' : 'Decrease'}
                    >
                      −
                    </button>
                    <span className="min-w-[2rem] text-center font-bold tabular-nums">{line.quantity}</span>
                    <button
                      type="button"
                      onClick={() => addToCart(line)}
                      className="flex h-12 w-12 items-center justify-center rounded-lg text-lg font-bold text-violet-700 hover:bg-violet-50"
                      aria-label={language === 'es' ? 'Más' : 'Increase'}
                    >
                      +
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeLine(line.unique_id)}
                    className="flex h-12 w-12 items-center justify-center rounded-lg text-stone-400 hover:bg-red-50 hover:text-red-600"
                    aria-label={language === 'es' ? 'Eliminar' : 'Remove'}
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!cartOpen && (
        <p className="pointer-events-none fixed bottom-32 left-0 right-0 z-10 text-center text-sm text-violet-400/90">
          {copy.emptyCart}
        </p>
      )}

      <div
        className={`fixed bottom-28 right-6 z-40 flex flex-col items-end gap-3 sm:bottom-32 sm:right-10 ${chatOpen ? 'pointer-events-none opacity-0' : ''}`}
      >
        <button
          type="button"
          onClick={() => setChatOpen(true)}
          className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-fuchsia-600 text-2xl text-white shadow-xl shadow-violet-600/40 transition hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2"
          aria-label="Open menu assistant"
        >
          ✨
        </button>
      </div>

      <div
        ref={chatPanelRef}
        className={`fixed bottom-28 right-6 z-50 w-[min(100vw-2rem,420px)] origin-bottom-right transition sm:bottom-32 sm:right-10 ${
          chatOpen ? 'scale-100 opacity-100' : 'pointer-events-none scale-95 opacity-0'
        }`}
      >
        <div className="flex max-h-[min(70vh,520px)] flex-col overflow-hidden rounded-3xl border border-violet-200 bg-white shadow-2xl shadow-violet-900/20">
          <div className="flex items-center justify-between bg-gradient-to-r from-violet-800 to-fuchsia-700 px-5 py-4 text-white">
            <span className="font-display text-lg font-bold">Boba assistant</span>
            <button
              type="button"
              onClick={() => setChatOpen(false)}
              className="flex h-12 w-12 items-center justify-center rounded-lg text-white/80 hover:bg-white/10 hover:text-white"
              aria-label="Close assistant"
            >
              ✕
            </button>
          </div>
          <div className="max-h-72 overflow-y-auto space-y-3 bg-violet-50/50 p-4">
            {chatLog.length === 0 && (
              <p className="text-center text-sm text-violet-600/80">{copy.assistantHint}</p>
            )}
            {chatLog.map((msg, i) => (
              <div
                key={i}
                className={`max-w-[90%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
                  msg.sender === 'user'
                    ? 'ml-auto bg-violet-600 text-white'
                    : 'border border-violet-100 bg-white text-stone-800'
                }`}
              >
                <span dangerouslySetInnerHTML={{ __html: msg.text.replace(/\n/g, '<br/>') }} />
              </div>
            ))}
            {isChatting && (
              <p className="text-sm italic text-violet-500">…</p>
            )}
            <div ref={chatEndRef} />
          </div>
          <form onSubmit={handleChatSubmit} className="flex items-center gap-2 border-t border-violet-100 bg-white p-3">
            <VoiceDictationButton
              lang={language === 'es' ? 'es-ES' : 'en-US'}
              onTranscript={(text) => setChatInput((prev) => prev + text)}
              size="sm"
            />
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              className="min-h-[48px] flex-1 rounded-2xl border border-violet-100 bg-stone-50 px-4 text-base outline-none focus:ring-2 focus:ring-violet-400"
              placeholder={language === 'es' ? 'Habla o escribe tu pregunta…' : 'Speak or type your question…'}
            />
            <button
              type="submit"
              disabled={isChatting}
              className="min-h-[48px] rounded-2xl bg-violet-600 px-5 font-semibold text-white hover:bg-violet-500 disabled:opacity-50"
            >
              {language === 'es' ? 'Enviar' : 'Send'}
            </button>
          </form>
        </div>
      </div>

      <footer className="fixed bottom-0 left-0 right-0 z-30 border-t border-violet-200/90 bg-white/95 px-5 py-5 backdrop-blur-md sm:px-10">
        <div className="mx-auto flex max-w-6xl flex-col items-stretch gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div aria-live="polite" aria-atomic="true">
            <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">{copy.total}</p>
            <p className="font-display text-4xl font-bold tabular-nums text-violet-950 sm:text-5xl">${cartTotal.toFixed(2)}</p>
          </div>
          <button
            id="checkout-btn"
            type="button"
            onClick={handleCheckout}
            disabled={cart.length === 0 || checkoutLoading}
            className="min-h-[56px] rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-10 py-4 text-xl font-bold text-white shadow-lg shadow-violet-600/30 transition hover:from-violet-500 hover:to-fuchsia-500 disabled:cursor-not-allowed disabled:opacity-40 sm:min-w-[240px] sm:text-2xl"
            aria-label={copy.checkout}
          >
            {checkoutLoading ? '…' : copy.checkout}
          </button>
        </div>
      </footer>

      {orderSuccess && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-violet-950/55 px-5 py-10 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="order-success-title"
          aria-describedby="order-success-desc"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOrderSuccess(null);
          }}
        >
          <div
            className="w-full max-w-md rounded-3xl border border-violet-200 bg-white p-8 shadow-2xl shadow-violet-900/25"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 text-3xl text-white shadow-lg shadow-emerald-500/30" aria-hidden="true">
              ✓
            </div>
            <h2 id="order-success-title" className="text-center font-display text-2xl font-bold text-violet-950 sm:text-3xl">
              {copy.orderSuccessTitle}
            </h2>
            <p id="order-success-desc" className="mt-3 text-center text-base text-stone-600">
              {copy.orderSuccessLead}
            </p>
            <p className="mt-4 text-center font-display text-lg font-semibold text-violet-900">
              {copy.orderSuccessThankYou}
              {firstNameFromUser(sessionUser) ? `, ${firstNameFromUser(sessionUser)}!` : '!'}
            </p>
            <p className="mt-6 text-center">
              <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">
                {copy.orderSuccessOrderLabel}
              </span>
              <span className="mt-1 block font-display text-3xl font-bold tabular-nums text-violet-950">
                #{orderSuccess.orderId}
              </span>
            </p>
            <button
              ref={orderSuccessCtaRef}
              type="button"
              onClick={() => setOrderSuccess(null)}
              className="mt-8 w-full min-h-[52px] rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-6 py-3 text-lg font-bold text-white shadow-lg shadow-violet-600/30 transition hover:from-violet-500 hover:to-fuchsia-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
            >
              {copy.orderSuccessCta}
            </button>
            <p className="mt-3 text-center text-xs text-stone-500">
              {language === 'es' ? 'Toca fuera o pulsa Escape para cerrar.' : 'Tap outside or press Escape to close.'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
