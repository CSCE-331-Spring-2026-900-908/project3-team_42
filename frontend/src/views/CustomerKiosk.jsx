import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
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
  const navigate = useNavigate();
  const [sessionUser, setSessionUser] = useState(null);
  const [sessionLoading, setSessionLoading] = useState(true);

  const [menuItems, setMenuItems] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [customizingItem, setCustomizingItem] = useState(null);
  const [sweetness, setSweetness] = useState('Normal 100%');
  const [ice, setIce] = useState('Regular');
  const [selectedToppings, setSelectedToppings] = useState([]);
  const [cart, setCart] = useState([]);
  const [orderSuccess, setOrderSuccess] = useState(null);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const orderSuccessCtaRef = useRef(null);
  const [language, setLanguage] = useState('en');
  const [isTranslating, setIsTranslating] = useState(false);
  const [weather, setWeather] = useState(null);

  const [chatOpen, setChatOpen] = useState(false);
  const [chatLog, setChatLog] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatting, setIsChatting] = useState(false);
  const chatEndRef = useRef(null);
  const chatPanelRef = useRef(null);

  const [copy, setCopy] = useState(() => defaultKioskCopy());
  const googleSignInAvailable = Boolean(googleClientId);
  const getBasePrice = (item) => Number(item?.effective_price ?? item?.default_price ?? 0);

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
    api.get('/weather').then((res) => setWeather(res.data)).catch(() => setWeather(null));
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

  const categories = useMemo(() => {
    const cats = new Set(menuItems.map(item => item.category || 'Specialty'));
    return ['All', ...cats];
  }, [menuItems]);

  const displayedItems = useMemo(() => {
    if (selectedCategory === 'All') return menuItems;
    return menuItems.filter(item => (item.category || 'Specialty') === selectedCategory);
  }, [menuItems, selectedCategory]);

  const weatherRecommendations = useMemo(() => {
    if (!weather || menuItems.length === 0) return [];
    const temp = weather.temperature;
    const forecast = (weather.shortForecast || '').toLowerCase();
    let recommended = [];
    if (temp >= 80) {
      recommended = menuItems.filter(i => {
        const cat = (i.category || '').toLowerCase();
        const name = (i.name || '').toLowerCase();
        return cat === 'slush' || cat === 'fruit tea' || name.includes('mango') || name.includes('lemon') || name.includes('passion') || name.includes('ice');
      });
    } else if (temp <= 55 || forecast.includes('rain') || forecast.includes('cloud')) {
      recommended = menuItems.filter(i => {
        const cat = (i.category || '').toLowerCase();
        const name = (i.name || '').toLowerCase();
        return cat === 'milk tea' || name.includes('taro') || name.includes('hokkaido') || name.includes('thai') || name.includes('coffee');
      });
    } else {
      recommended = menuItems.filter(i => {
        const cat = (i.category || '').toLowerCase();
        return cat === 'specialty' || cat === 'matcha';
      });
    }
    return recommended.slice(0, 4);
  }, [weather, menuItems]);

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
      const menuContext = menuItems.map((i) => `${i.name}: ${i.description} ($${getBasePrice(i).toFixed(2)})`).join('; ');
      const res = await api.post('/chat', { message: userMsg, menuContext, language });
      setChatLog((prev) => [...prev, { sender: 'ai', text: res.data.reply }]);
    } catch {
      setChatLog((prev) => [...prev, { sender: 'ai', text: "Sorry, I'm having trouble connecting." }]);
    }
    setIsChatting(false);
  };

  const TOPPING_OPTIONS = [
    { id: 'boba', name: 'Boba (+0.50)', price: 0.50 },
    { id: 'lychee_jelly', name: 'Lychee Jelly (+0.50)', price: 0.50 },
    { id: 'pudding', name: 'Pudding (+0.50)', price: 0.50 }
  ];

  const toggleTopping = (id) => {
    setSelectedToppings((prev) => 
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  };

  const handleDrinkClick = (item) => {
    setCustomizingItem(item);
    setSweetness('Normal 100%');
    setIce('Regular');
    setSelectedToppings([]);
  };

  const handleCustomizationConfirm = () => {
    if (!customizingItem) return;
    const finalItem = {
      ...customizingItem,
      custom_price: getBasePrice(customizingItem) + (selectedToppings.length * 0.5),
      customization: {
        sweetness,
        ice,
        toppings: selectedToppings
      }
    };
    addToCart(finalItem);
    setCustomizingItem(null);
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

  const cartTotal = cart.reduce((sum, line) => sum + (line.custom_price ?? getBasePrice(line)) * line.quantity, 0);
  const itemCount = cart.reduce((n, line) => n + line.quantity, 0);

  const handleCheckout = () => {
    if (cart.length === 0) return;
    setPaymentModalOpen(true);
  };

  const processPayment = async () => {
    setCheckoutLoading(true);
    const total_amount = cartTotal * 1.0825;
    const formattedItems = cart.map((i) => ({
      menu_item_id: i.id,
      quantity: i.quantity,
      customization: i.customization || null,
      price: i.custom_price ?? getBasePrice(i),
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
      setPaymentModalOpen(false);
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

  const weatherLabel = useMemo(() => {
    if (!weather) return null;
    const temp = weather.temperature;
    if (temp >= 80) return { emoji: '☀️', text: 'Hot outside — cool down with these!', bg: 'bg-amber-50 border-amber-200 text-amber-800' };
    if (temp <= 55) return { emoji: '🌧️', text: 'Chilly today — warm up with these!', bg: 'bg-sky-50 border-sky-200 text-sky-800' };
    return { emoji: '🌤️', text: 'Nice day — try something special!', bg: 'bg-emerald-50 border-emerald-200 text-emerald-800' };
  }, [weather]);

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
      <div className="relative min-h-screen bg-gradient-to-b from-violet-100/80 via-fuchsia-50/40 to-white font-[family-name:var(--font-ui)] px-5 py-16">
        <button 
          onClick={() => navigate(-1)} 
          className="absolute top-6 left-6 flex items-center justify-center p-3 rounded-full bg-white/60 hover:bg-white text-violet-900 shadow-sm backdrop-blur-sm transition"
          aria-label="Back"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>
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
    <div className="flex h-screen flex-row bg-[#faf9f7] font-sans overflow-hidden text-stone-800">
      
      {/* Main Left Menu Section */}
      <div className="flex flex-1 flex-col px-6 pt-5 pb-0 relative z-10">
        {/* Top Bar */}
        <header className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate(-1)} 
              className="flex items-center justify-center p-2 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-700 transition"
              aria-label="Back"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <div>
              <h2 className="text-3xl font-extrabold text-stone-900 tracking-tight">{copy.welcome}</h2>
              <p className="text-sm text-stone-500 mt-0.5">{language === 'es' ? 'Elige tu bebida favorita' : 'Pick your favorite drink'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 rounded-full border border-stone-200 bg-white px-3 py-1.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-stone-100 text-xs font-bold text-stone-700">
                {(sessionUser.name || sessionUser.email || '?').slice(0, 1).toUpperCase()}
              </span>
              <span className="text-sm font-medium text-stone-700 pr-1">{firstNameFromUser(sessionUser)}</span>
            </div>
            <button type="button" onClick={handleLogout} className="rounded-full border border-stone-200 bg-white px-3 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-50">
              {sessionUser.isGuest ? copy.endSession : copy.signOut}
            </button>
            <button type="button" onClick={handleTranslateToggle} disabled={isTranslating} className="rounded-full border border-stone-200 bg-white px-3 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-50 disabled:opacity-50">
              {isTranslating ? '…' : (language === 'es' ? '🇺🇸 English' : '🇲🇽 Español')}
            </button>
          </div>
        </header>

        {/* Weather Recommendation Banner */}
        {weatherLabel && weatherRecommendations.length > 0 && (
          <div className={`mb-4 rounded-2xl border p-4 ${weatherLabel.bg}`}>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xl">{weatherLabel.emoji}</span>
              <span className="font-bold text-sm">{weatherLabel.text}</span>
              {weather && <span className="ml-auto text-xs font-medium opacity-70">{weather.temperature}°{weather.unit}</span>}
            </div>
            <div className="flex gap-3 overflow-x-auto pb-1">
              {weatherRecommendations.map(item => (
                <button
                  key={`rec-${item.id}`}
                  onClick={() => handleDrinkClick(item)}
                  className="flex shrink-0 items-center gap-3 rounded-xl border border-white/60 bg-white/80 px-4 py-3 text-left transition hover:bg-white hover:shadow-sm active:scale-95"
                >
                  <span className="text-2xl">🧋</span>
                  <div>
                    <p className="text-sm font-bold leading-tight text-stone-800">{item.name}</p>
                    <p className="text-xs font-medium text-stone-500">${getBasePrice(item).toFixed(2)}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Category Tabs */}
        <div className="mb-4 flex flex-wrap gap-2">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`rounded-full px-5 py-2 text-sm font-semibold transition ${selectedCategory === cat ? 'bg-stone-800 text-white' : 'border border-stone-200 bg-white text-stone-600 hover:bg-stone-50'}`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Drink Grid */}
        <div className="min-h-0 flex-1 overflow-y-auto pb-6">
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {displayedItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleDrinkClick(item)}
                className="group flex flex-col items-center justify-start rounded-2xl border border-stone-200 bg-white text-center transition hover:border-stone-300 hover:shadow-md active:scale-[0.97]"
              >
                <div className="w-full aspect-[4/3] rounded-t-2xl bg-stone-100 flex items-center justify-center overflow-hidden">
                  {item.image_url ? (
                    <img src={item.image_url} alt={item.name} className="h-full w-full object-cover transition group-hover:scale-105" />
                  ) : (
                    <span className="text-5xl opacity-30">🧋</span>
                  )}
                </div>
                <div className="p-4 w-full flex flex-col items-center flex-1">
                  <span className="text-[15px] font-bold leading-snug text-stone-800 line-clamp-2">
                    {item.name}
                  </span>
                  <span className="mt-auto pt-2 text-base font-semibold text-stone-500">
                    ${getBasePrice(item).toFixed(2)}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Right Sidebar Cart Section */}
      <aside className="w-[360px] flex shrink-0 flex-col border-l border-stone-200 bg-white relative z-20">
        <div className="border-b border-stone-100 px-6 py-5 flex justify-between items-center">
          <h2 className="text-lg font-bold text-stone-900">{copy.yourOrder}</h2>
          <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-bold text-stone-500">
            {itemCount} {itemCount === 1 ? 'item' : 'items'}
          </span>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 relative">
          {cart.length === 0 ? (
            <div className="flex h-full items-center justify-center flex-col -mt-10 opacity-60">
              <span className="text-5xl mb-4">🧋</span>
              <p className="font-medium text-stone-400 text-center text-sm">{copy.emptyCart}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {cart.map((item) => (
                <div key={item.unique_id} className="flex flex-col rounded-xl border border-stone-100 bg-stone-50 p-3">
                  <div className="flex justify-between items-start font-bold text-stone-800 text-[14px]">
                    <span className="w-2/3 pr-2 leading-tight">{item.name}</span>
                    <span>${(item.custom_price ?? getBasePrice(item)).toFixed(2)}</span>
                  </div>
                  {item.customization && (
                    <div className="text-xs text-stone-400 mt-1 leading-relaxed">
                      S: {item.customization.sweetness} | I: {item.customization.ice}
                      {item.customization.toppings?.length > 0 && ` | +${item.customization.toppings.join(', ')}`}
                    </div>
                  )}
                  <div className="mt-2 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <button onClick={() => decrementLine(item.unique_id)} className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-lg font-bold text-stone-500 border border-stone-200 hover:bg-stone-100">−</button>
                      <span className="font-bold tabular-nums text-stone-800">{item.quantity}</span>
                      <button onClick={() => addToCart(item)} className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-lg font-bold text-stone-500 border border-stone-200 hover:bg-stone-100">+</button>
                    </div>
                    <button onClick={() => removeLine(item.unique_id)} className="text-xs font-semibold text-red-400 hover:text-red-500 transition">Remove</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="px-5 py-5 shrink-0 border-t border-stone-100">
          <div className="flex justify-between text-sm font-medium text-stone-500 mb-1">
             <span>{language === 'es' ? 'Subtotal' : 'Subtotal'}</span>
             <span>${cartTotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm font-medium text-stone-500 mb-3">
             <span>{language === 'es' ? 'Impuesto' : 'Tax (8.25%)'}</span>
             <span>${(cartTotal * 0.0825).toFixed(2)}</span>
          </div>
          <div className="border-t border-stone-200 pt-3 flex justify-between text-2xl font-black text-stone-900">
            <span>{copy.total}</span>
            <span>${(cartTotal * 1.0825).toFixed(2)}</span>
          </div>

          <button
            id="checkout-btn"
            onClick={handleCheckout}
            disabled={cart.length === 0 || checkoutLoading}
            className="w-full mt-5 rounded-2xl bg-stone-800 py-4 text-lg font-bold text-white transition hover:bg-stone-700 active:scale-[0.98] disabled:opacity-40 disabled:hover:bg-stone-800"
          >
            {checkoutLoading ? '...' : copy.checkout}
          </button>
        </div>
      </aside>

      {/* AI Chat Bot Overlay */}
      <div className={`fixed bottom-6 right-96 mr-6 z-40 flex flex-col items-end gap-3 ${chatOpen ? 'pointer-events-none opacity-0' : ''}`}>
        <button
          type="button"
          onClick={() => setChatOpen(true)}
          className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white border border-slate-200 text-2xl shadow-lg transition hover:scale-105 active:scale-95"
          aria-label="Open menu assistant"
        >
          ✨
        </button>
      </div>

      <div
        ref={chatPanelRef}
        className={`fixed bottom-6 right-96 mr-6 z-50 w-[380px] origin-bottom-right transition ${
          chatOpen ? 'scale-100 opacity-100' : 'pointer-events-none scale-95 opacity-0'
        }`}
      >
        <div className="flex max-h-[500px] flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
          <div className="flex items-center justify-between bg-slate-900 px-5 py-4 text-white">
            <span className="font-bold">Boba assistant</span>
            <button onClick={() => setChatOpen(false)} className="text-white/80 hover:text-white">✕</button>
          </div>
          <div className="flex-1 min-h-[250px] max-h-72 overflow-y-auto space-y-3 bg-slate-50 p-4">
            {chatLog.length === 0 && <p className="text-center text-sm text-slate-500">{copy.assistantHint}</p>}
            {chatLog.map((msg, i) => (
              <div key={i} className={`max-w-[90%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${msg.sender === 'user' ? 'ml-auto bg-slate-800 text-white' : 'border border-slate-200 bg-white text-slate-800'}`}>
                <span dangerouslySetInnerHTML={{ __html: msg.text.replace(/\n/g, '<br/>') }} />
              </div>
            ))}
            {isChatting && <p className="text-sm italic text-slate-400">…</p>}
            <div ref={chatEndRef} />
          </div>
          <form onSubmit={handleChatSubmit} className="flex items-center gap-2 border-t border-slate-200 bg-white p-3">
            <VoiceDictationButton lang={language === 'es' ? 'es-ES' : 'en-US'} onTranscript={(text) => setChatInput((prev) => prev + text)} size="sm" />
            <input type="text" value={chatInput} onChange={(e) => setChatInput(e.target.value)} className="min-h-[44px] flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:ring-2 focus:ring-slate-300" placeholder={language === 'es' ? 'Habla o escribe tu pregunta…' : 'Speak or type...'} />
            <button type="submit" disabled={isChatting} className="min-h-[44px] rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50">
              {language === 'es' ? 'Enviar' : 'Send'}
            </button>
          </form>
        </div>
      </div>

      {/* Customization Modal */}
      {customizingItem && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <div className="mb-6 flex items-start justify-between">
              <div>
                <h2 className="text-2xl font-black tracking-tight text-slate-900">Customize</h2>
                <p className="font-medium text-slate-500 mt-1.5">{customizingItem.name}</p>
              </div>
              <button onClick={() => setCustomizingItem(null)} className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="space-y-6">
              <div>
                <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-slate-800">Sweetness</h3>
                <div className="flex flex-wrap gap-2">
                  {['0%', '25%', '50%', '75%', '100%'].map(level => {
                    const label = `${level === '100%' ? 'Normal' : level === '0%' ? 'No Sugar' : level} ${level}`;
                    return (
                      <button
                        key={level}
                        onClick={() => setSweetness(level)}
                        className={`rounded-xl border px-3 py-2 text-sm font-bold transition ${sweetness === level ? 'border-[#93c5fd] bg-[#bfdbfe] text-blue-900 shadow-sm' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-slate-800">Ice Level</h3>
                <div className="flex flex-wrap gap-2">
                  {['no ice', 'light ice', 'regular ice', 'extra ice'].map(level => (
                    <button
                      key={level}
                      onClick={() => setIce(level)}
                      className={`rounded-xl border px-3 py-2 text-sm font-bold transition ${ice === level ? 'border-[#93c5fd] bg-[#bfdbfe] text-blue-900 shadow-sm' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
                    >
                      {level.charAt(0).toUpperCase() + level.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-slate-800">Toppings (+<span className="tabular-nums">$0.50</span>)</h3>
                <div className="flex flex-col gap-2">
                  {TOPPING_OPTIONS.map(topping => {
                    const tName = topping.name.split(' ')[0];
                    return (
                      <label key={topping.id} className={`flex cursor-pointer items-center justify-between rounded-xl border p-3 transition ${selectedToppings.includes(tName) ? 'border-[#93c5fd] bg-[#eff6ff] ring-1 ring-blue-300' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                        <span className="font-medium text-slate-800">{topping.name.replace(' (+0.50)', '')}</span>
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={selectedToppings.includes(tName)}
                            onChange={() => toggleTopping(tName)}
                            className="h-5 w-5 rounded border-slate-300 text-blue-500 focus:ring-blue-400 focus:ring-offset-1"
                          />
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="mt-8">
              <button
                onClick={handleCustomizationConfirm}
                className="w-full rounded-2xl bg-[#93c5fd] py-4 text-lg font-bold text-white shadow-sm transition hover:bg-[#60a5fa] active:scale-[0.98]"
              >
                Add — <span className="tabular-nums">${(getBasePrice(customizingItem) + selectedToppings.length * 0.50).toFixed(2)}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {paymentModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl bg-white p-8 shadow-2xl flex flex-col items-center text-center">
            <h2 className="text-2xl font-black text-slate-900 mb-2">Tap to Pay</h2>
            <p className="text-slate-500 mb-6 font-medium">Total: ${(cartTotal * 1.0825).toFixed(2)}</p>
            
            <button
              onClick={processPayment}
              disabled={checkoutLoading}
              className="group relative flex h-48 w-48 flex-col items-center justify-center gap-4 rounded-[2rem] bg-slate-50 border-2 border-dashed border-slate-300 transition-all hover:border-[#93c5fd] hover:bg-[#eff6ff] active:scale-95 disabled:pointer-events-none disabled:opacity-70"
            >
              <div className="text-6xl transition-transform group-hover:scale-110">💳</div>
              <span className="font-bold text-slate-600 group-hover:text-blue-600">
                {checkoutLoading ? 'Processing...' : 'Tap Simulator'}
              </span>
            </button>
            
            <button 
              onClick={() => setPaymentModalOpen(false)}
              disabled={checkoutLoading}
              className="mt-6 text-sm font-bold text-slate-400 hover:text-slate-600 transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Order Success Modal */}
      {orderSuccess && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-md">
          <div className="w-full max-w-sm rounded-3xl bg-white p-8 shadow-2xl text-center overflow-hidden relative">
            <div className="absolute inset-x-0 top-0 h-2 bg-green-400"></div>
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-500 text-3xl mb-6 shadow-inner">
              ✓
            </div>
            <h2 className="text-3xl font-black text-slate-900 mb-2">{copy.orderSuccessTitle}</h2>
            <p className="text-slate-500 font-medium mb-6">{copy.orderSuccessLead}</p>
            
            <div className="bg-slate-50 rounded-xl py-4 mb-6 border border-slate-100">
               <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Order Number</p>
               <p className="text-4xl font-black text-slate-800">#{orderSuccess.orderId}</p>
            </div>
            
            <button
              onClick={() => setOrderSuccess(null)}
              className="w-full rounded-2xl bg-green-500 py-4 text-lg font-bold text-white shadow-sm transition hover:bg-green-600 active:scale-[0.98]"
            >
              Start New Order
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
