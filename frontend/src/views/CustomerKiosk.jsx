import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import {
  calculateCustomizedDrinkPrice,
  DEFAULT_ICE_LEVEL,
  DEFAULT_SIZE_OPTION,
  HOT_ICE_LEVEL,
  SIZE_OPTIONS,
} from '../lib/drinkCustomization';
import { loadActiveKioskCart, saveActiveKioskCart } from '../lib/kioskCart';

const LANGUAGE_OPTIONS = [
  { code: 'en', label: 'English (Default)' },
  { code: 'es', label: 'Spanish' },
  { code: 'fr', label: 'French' },
  { code: 'de', label: 'German' },
  { code: 'zh-CN', label: 'Chinese (Simplified)' },
  { code: 'ja', label: 'Japanese' },
  { code: 'ko', label: 'Korean' },
  { code: 'pt', label: 'Portuguese' },
];

function defaultKioskCopy() {
  return {
    welcome: 'Welcome to Reveille Boba',
    translateBtn: 'Translate',
    subtitle: 'Pick your favorite drink',
    addToOrder: 'Add to order',
    total: 'Total',
    checkout: 'Checkout',
    yourOrder: 'Your order',
    stepBrowse: 'Browse',
    stepReview: 'Review',
    stepPay: 'Checkout',
    emptyCart: 'Tap a drink to start your order',
    assistantHint: 'Ask about flavors, ice, or toppings',
    catAll: 'All',
    catFruitTea: 'Fruit Tea',
    catMatcha: 'Matcha',
    catMilkTea: 'Milk Tea',
    catSlush: 'Slush',
    catSpecialty: 'Specialty',
    catSeasonal: 'Seasonal',
    weatherHot: 'Hot outside - cool down with these!',
    weatherCold: 'Chilly today - warm up with these!',
    weatherNice: 'Nice day - try something special!',
    customize: 'Customize',
    hotLabel: 'Hot',
    hotHelper: 'Hot drinks are served with no ice.',
    sizeLabel: 'SIZE',
    sweetnessLabel: 'SWEETNESS',
    iceLabel: 'ICE LEVEL',
    toppingsLabel: 'TOPPINGS (+$0.50)',
    addBtnPrefix: 'Add —',
    sugar0: 'No Sugar 0%',
    sugar25: '25%',
    sugar50: '50%',
    sugar75: '75%',
    sugar100: 'Normal 100%',
    sugar125: 'Extra Sweet 125%',
    iceNone: 'No ice',
    iceLight: 'Light ice',
    iceRegular: 'Regular ice',
    iceExtra: 'Extra ice',
    topPearls: 'Pearls (Boba)',
    topLychee: 'Lychee Jelly',
    topCrystal: 'Crystal Boba',
    topIceCream: 'Ice Cream',
    topCoffeeJelly: 'Coffee Jelly',
    topHoneyJelly: 'Honey Jelly',
    topMango: 'Mango Popping Boba',
    topCreama: 'Creama',
    topPudding: 'Pudding',
    topStrawberry: 'Strawberry Popping Boba',
  };
}

const formatChatMsg = (text) => {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br/>');
};

function DrinkImage({ item, baseMenuItems, className, fallbackClassName }) {
  const [error, setError] = useState(false);
  const getCategoryFilename = (category) => {
    const cat = (category || 'Specialty').toLowerCase();
    if (cat.includes('fruit')) return 'fruit-tea.png';
    if (cat.includes('matcha')) return 'matcha-tea.png';
    if (cat.includes('milk')) return 'milk-tea.png';
    if (cat.includes('slush')) return 'slush.png';
    if (cat.includes('seasonal')) return 'seasonal-tea.png';
    return 'specialty.png';
  };

  const originalItem = baseMenuItems?.find(b => b.id === item.id) || item;
  const isPlaceholder = item.image_url === '/images/placeholder.png' || item.image_url === 'null';
  const imageSrc = (!item.image_url || isPlaceholder) 
    ? `/menu-images/${getCategoryFilename(originalItem.category)}` 
    : item.image_url;

  if (error) {
    return <span className={fallbackClassName || "text-5xl opacity-30"} aria-hidden="true">{'\u{1F9CB}'}</span>;
  }

  return (
    <img
      src={imageSrc}
      alt={item.name}
      className={className || "h-full w-full object-cover transition group-hover:scale-105"}
      onError={() => setError(true)}
    />
  );
}

export default function CustomerKiosk() {
  const navigate = useNavigate();

  const [menuItems, setMenuItems] = useState([]);
  const [baseMenuItems, setBaseMenuItems] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('All');

  const [customizingItem, setCustomizingItem] = useState(null);
  const [sweetness, setSweetness] = useState('Normal 100%');
  const [ice, setIce] = useState(DEFAULT_ICE_LEVEL);
  const [hot, setHot] = useState(false);
  const [size, setSize] = useState(DEFAULT_SIZE_OPTION.id);
  const [selectedToppings, setSelectedToppings] = useState([]);
  const [cart, setCart] = useState(() => loadActiveKioskCart());
  const [language, setLanguage] = useState('en');
  const [isTranslating, setIsTranslating] = useState(false);
  const [weather, setWeather] = useState(null);

  const [chatOpen, setChatOpen] = useState(false);
  const [chatLog, setChatLog] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatting, setIsChatting] = useState(false);
  const chatEndRef = useRef(null);
  const chatPanelRef = useRef(null);
  const translateMenuRef = useRef(null);
  const [translateMenuOpen, setTranslateMenuOpen] = useState(false);

  const [copy, setCopy] = useState(() => defaultKioskCopy());
  const getCatName = useCallback((cat) => {
    if (cat === 'All') return copy.catAll;
    if (cat === 'Fruit Tea') return copy.catFruitTea;
    if (cat === 'Matcha') return copy.catMatcha;
    if (cat === 'Milk Tea') return copy.catMilkTea;
    if (cat === 'Slush') return copy.catSlush;
    if (cat === 'Specialty') return copy.catSpecialty;
    if (cat === 'Seasonal') return copy.catSeasonal;
    return cat;
  }, [copy]);
  const getBasePrice = (item) => Number(item?.effective_price ?? item?.default_price ?? 0);

  useEffect(() => {
    api.get('/menu').then((res) => {
      setMenuItems(res.data);
      setBaseMenuItems(res.data);
    }).catch(console.error);
    api.get('/weather').then((res) => setWeather(res.data)).catch(() => setWeather(null));
  }, []);

  useEffect(() => {
    saveActiveKioskCart(cart);
  }, [cart]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatLog, isChatting]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && chatOpen) setChatOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [chatOpen]);

  useEffect(() => {
    const onPointerDown = (e) => {
      if (!translateMenuRef.current) return;
      if (!translateMenuRef.current.contains(e.target)) setTranslateMenuOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, []);

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
    if (selectedCategory === 'All') {
      return [...menuItems].sort((a, b) => {
        const hashA = (a.id * 137) % 251;
        const hashB = (b.id * 137) % 251;
        return hashA - hashB;
      });
    }
    return menuItems.filter(item => (item.category || 'Specialty') === selectedCategory);
  }, [menuItems, selectedCategory]);

  const weatherRecommendations = useMemo(() => {
    if (!weather || menuItems.length === 0) return [];
    const temp = weather.temperature;
    const forecast = (weather.shortForecast || '').toLowerCase();
    let recommended = [];
    if (temp >= 80) {
      recommended = baseMenuItems.filter(i => {
        const cat = (i.category || '').toLowerCase();
        const name = (i.name || '').toLowerCase();
        return cat === 'slush' || cat === 'fruit tea' || name.includes('mango') || name.includes('lemon') || name.includes('passion') || name.includes('ice');
      });
    } else if (temp <= 55 || forecast.includes('rain') || forecast.includes('cloud')) {
      recommended = baseMenuItems.filter(i => {
        const cat = (i.category || '').toLowerCase();
        const name = (i.name || '').toLowerCase();
        return cat === 'milk tea' || name.includes('taro') || name.includes('hokkaido') || name.includes('thai') || name.includes('coffee');
      });
    } else {
      recommended = menuItems.filter(i => {
        const cat = (i.category || '').toLowerCase();
        return cat === 'specialty' || cat === 'matcha' || cat === 'seasonal';
      });
    }
    return recommended.slice(0, 4).map(bItem => menuItems.find(m => m.id === bItem.id) || bItem);
  }, [baseMenuItems, weather, menuItems]);

  const translateText = async (text, target) => {
    if (target === 'en') return text;
    try {
      const res = await api.post('/translate', { text, target });
      return res.data.translatedText;
    } catch {
      return text;
    }
  };

  const handleLanguageSelect = async (targetLang) => {
    if (isTranslating || !targetLang || targetLang === language) {
      setTranslateMenuOpen(false);
      return;
    }
    setIsTranslating(true);
    setTranslateMenuOpen(false);

    const baseCopy = defaultKioskCopy();

    if (targetLang !== 'en') {
      try {
        const keys = Object.keys(baseCopy);
        const translated = await Promise.all(keys.map((k) => translateText(baseCopy[k], targetLang)));
        const nextCopy = keys.reduce((acc, k, i) => ({ ...acc, [k]: translated[i] }), {});
        setCopy((c) => ({ ...c, ...nextCopy }));

        const translatedMenu = await Promise.all(
          baseMenuItems.map(async (item) => ({
            ...item,
            name: await translateText(item.name, targetLang),
            description: await translateText(item.description, targetLang),
          }))
        );
        setMenuItems(translatedMenu);
      } catch (err) {
        console.error('Translation failed', err);
      }
    } else {
      setMenuItems(baseMenuItems);
      setCopy(baseCopy);
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

  const getToppingOptions = () => [
    { id: 'pearls_boba', name: copy.topPearls, price: 0.50 },
    { id: 'lychee_jelly', name: copy.topLychee, price: 0.50 },
    { id: 'crystal_boba', name: copy.topCrystal, price: 0.50 },
    { id: 'ice_cream', name: copy.topIceCream, price: 0.50 },
    { id: 'coffee_jelly', name: copy.topCoffeeJelly, price: 0.50 },
    { id: 'honey_jelly', name: copy.topHoneyJelly, price: 0.50 },
    { id: 'mango_popping_boba', name: copy.topMango, price: 0.50 },
    { id: 'creama', name: copy.topCreama, price: 0.50 },
    { id: 'pudding', name: copy.topPudding, price: 0.50 },
    { id: 'strawberry_popping_boba', name: copy.topStrawberry, price: 0.50 },
  ];

  const toggleTopping = (id) => {
    setSelectedToppings((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  };

  const handleDrinkClick = (item) => {
    setCustomizingItem(item);
    setSweetness('Normal 100%');
    setIce(DEFAULT_ICE_LEVEL);
    setHot(false);
    setSize(DEFAULT_SIZE_OPTION.id);
    setSelectedToppings([]);
  };

  const handleHotToggle = () => {
    setHot((value) => {
      const next = !value;
      if (next) setIce(HOT_ICE_LEVEL);
      return next;
    });
  };

  const handleCustomizationConfirm = () => {
    if (!customizingItem) return;
    const finalItem = {
      ...customizingItem,
      custom_price: calculateCustomizedDrinkPrice({
        basePrice: getBasePrice(customizingItem),
        toppingCount: selectedToppings.length,
        sizeId: size,
      }),
      customization: {
        sweetness,
        size,
        ice: hot ? HOT_ICE_LEVEL : ice,
        temperature: hot ? 'Hot' : 'Cold',
        hot,
        toppings: selectedToppings
      }
    };
    addToCart(finalItem);
    setCustomizingItem(null);
  };

  const addToCart = (item) => {
    setCart((prev) => {
      const getLineKey = (line) => JSON.stringify({
        id: line.id,
        customization: line.customization || null,
        price: Number(line.custom_price ?? getBasePrice(line)),
      });
      const itemKey = getLineKey(item);
      const i = prev.findIndex((l) => (
        item.unique_id ? l.unique_id === item.unique_id : getLineKey(l) === itemKey
      ));
      if (i >= 0) {
        const next = [...prev];
        next[i] = { ...next[i], quantity: next[i].quantity + 1 };
        return next;
      }
      return [...prev, { ...item, unique_id: `${item.id}-${Date.now()}`, quantity: 1 }];
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
    navigate('/customer/checkout', { state: { cart, cartTotal } });
  };

  const weatherLabel = useMemo(() => {
    if (!weather) return null;
    const temp = weather.temperature;
    if (temp >= 80) return { emoji: '\u2600\uFE0F', text: copy.weatherHot, bg: 'bg-amber-50 border-amber-200 text-amber-800' };
    if (temp <= 55) return { emoji: '\u{1F327}\uFE0F', text: copy.weatherCold, bg: 'bg-sky-50 border-sky-200 text-sky-800' };
    return { emoji: '\u{1F324}\uFE0F', text: copy.weatherNice, bg: 'bg-emerald-50 border-emerald-200 text-emerald-800' };
  }, [copy.weatherCold, copy.weatherHot, copy.weatherNice, weather]);

  return (
    <div className="flex h-screen flex-row bg-[#faf9f7] font-sans overflow-hidden text-stone-800">

      {/* Main Left Menu Section */}
      <div className="flex flex-1 flex-col px-6 pt-5 pb-0 relative z-10">
        {/* Top Bar */}
        <header className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div>
              <h2 className="text-3xl font-extrabold text-stone-900 tracking-tight">{copy.welcome}</h2>
              <p className="text-sm text-stone-500 mt-0.5">{copy.subtitle}</p>
            </div>
          </div>
          <div className="relative" ref={translateMenuRef}>
            <button
              type="button"
              onClick={() => setTranslateMenuOpen((v) => !v)}
              disabled={isTranslating}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-600 disabled:opacity-60"
            >
              <span className="text-xs">A+</span>
              <span>{isTranslating ? 'Translating...' : 'Translate'}</span>
              <span className={`text-xs transition ${translateMenuOpen ? 'rotate-180' : ''}`}>^</span>
            </button>
            {translateMenuOpen && (
              <div className="absolute right-0 z-40 mt-2 max-h-72 w-56 overflow-y-auto rounded-xl border border-stone-200 bg-white py-1 shadow-lg">
                {LANGUAGE_OPTIONS.map((opt) => (
                  <button
                    key={opt.code}
                    type="button"
                    onClick={() => handleLanguageSelect(opt.code)}
                    className={`block w-full px-4 py-2 text-left text-sm transition hover:bg-stone-50 ${opt.code === language ? 'font-semibold text-blue-700' : 'text-stone-700'}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </header>

        {/* Weather Recommendation Banner */}
        {weatherLabel && weatherRecommendations.length > 0 && (
          <div className={`mb-4 rounded-2xl border p-4 ${weatherLabel.bg}`}>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xl">{weatherLabel.emoji}</span>
              <span className="font-bold text-sm">{weatherLabel.text}</span>
              {weather && <span className="ml-auto text-xs font-medium opacity-70">{weather.temperature} deg {weather.unit}</span>}
            </div>
            <div className="flex gap-3 overflow-x-auto pb-1">
              {weatherRecommendations.map(item => (
                <button
                  key={`rec-${item.id}`}
                  onClick={() => handleDrinkClick(item)}
                  className="flex shrink-0 items-center gap-3 rounded-xl border border-white/60 bg-white/80 px-4 py-3 text-left transition hover:bg-white hover:shadow-sm active:scale-95"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-stone-100">
                    <DrinkImage
                      item={item}
                      baseMenuItems={baseMenuItems}
                      className="h-full w-full object-cover"
                      fallbackClassName="text-2xl opacity-50"
                    />
                  </div>
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
              {getCatName(cat)}
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
                  <DrinkImage
                    item={item}
                    baseMenuItems={baseMenuItems}
                  />
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
              <span className="text-5xl mb-4" aria-hidden="true">{'\u{1F9CB}'}</span>
              <p className="font-medium text-stone-400 text-center text-sm">{copy.emptyCart}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {cart.map((item) => (
                <div key={item.unique_id} className="flex flex-col rounded-xl border border-stone-100 bg-stone-50 p-3">
                  <div className="flex gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-stone-200">
                      <DrinkImage
                        item={item}
                        baseMenuItems={baseMenuItems}
                        className="h-full w-full object-cover"
                        fallbackClassName="text-2xl opacity-50"
                      />
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-start font-bold text-stone-800 text-[14px]">
                        <span className="w-2/3 pr-2 leading-tight">{item.name}</span>
                        <span>${(item.custom_price ?? getBasePrice(item)).toFixed(2)}</span>
                      </div>
                      {item.customization && (
                        <div className="text-xs text-stone-400 mt-1 leading-relaxed">
                          S: {item.customization.sweetness}
                          {item.customization.size && ` | Size: ${item.customization.size}`}
                          {item.customization.hot && ' | Hot'}
                          {' | '}I: {item.customization.ice}
                          {item.customization.toppings?.length > 0 && ` | +${item.customization.toppings.join(', ')}`}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <button onClick={() => decrementLine(item.unique_id)} className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-lg font-bold text-stone-500 border border-stone-200 hover:bg-stone-100">-</button>
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
            disabled={cart.length === 0}
            className="w-full mt-5 rounded-2xl bg-stone-800 py-4 text-lg font-bold text-white transition hover:bg-stone-700 active:scale-[0.98] disabled:opacity-40 disabled:hover:bg-stone-800"
          >
            {copy.checkout}
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
          {'\u2728'}
        </button>
      </div>

      <div
        ref={chatPanelRef}
        className={`fixed bottom-6 right-96 mr-6 z-50 w-[380px] origin-bottom-right transition ${chatOpen ? 'scale-100 opacity-100' : 'pointer-events-none scale-95 opacity-0'
          }`}
      >
        <div className="flex max-h-[500px] flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
          <div className="flex items-center justify-between bg-slate-900 px-5 py-4 text-white">
            <span className="font-bold">Boba assistant</span>
            <button onClick={() => setChatOpen(false)} className="text-white/80 hover:text-white">{'\u2715'}</button>
          </div>
          <div className="flex-1 min-h-[250px] max-h-72 overflow-y-auto space-y-3 bg-slate-50 p-4">
            {chatLog.length === 0 && <p className="text-center text-sm text-slate-500">{copy.assistantHint}</p>}
            {chatLog.map((msg, i) => (
              <div key={i} className={`max-w-[90%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${msg.sender === 'user' ? 'ml-auto bg-slate-800 text-white' : 'border border-slate-200 bg-white text-slate-800'}`}>
                <span dangerouslySetInnerHTML={{ __html: formatChatMsg(msg.text) }} />
              </div>
            ))}
            {isChatting && <p className="text-sm italic text-slate-400">...</p>}
            <div ref={chatEndRef} />
          </div>
          <form onSubmit={handleChatSubmit} className="flex items-center gap-2 border-t border-slate-200 bg-white p-3">
            <input type="text" value={chatInput} onChange={(e) => setChatInput(e.target.value)} className="min-h-[44px] flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:ring-2 focus:ring-slate-300" placeholder={language === 'es' ? 'Habla o escribe tu pregunta...' : 'Speak or type...'} />
            <button type="submit" disabled={isChatting} className="min-h-[44px] rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50">
              {language === 'es' ? 'Enviar' : 'Send'}
            </button>
          </form>
        </div>
      </div>

      {/* Customization Modal */}
      {customizingItem && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
          <div className="flex max-h-[94vh] w-full max-w-2xl flex-col rounded-3xl bg-white p-5 shadow-2xl">
            <div className="mb-4 flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-stone-100 shadow-sm">
                  <DrinkImage
                    item={customizingItem}
                    baseMenuItems={baseMenuItems}
                    className="h-full w-full object-cover"
                    fallbackClassName="text-3xl opacity-50"
                  />
                </div>
                <div>
                  <h2 className="text-2xl font-black tracking-tight text-slate-900">Customize</h2>
                  <p className="font-medium text-slate-500 mt-1">{customizingItem.name}</p>
                </div>
              </div>
              <button onClick={() => setCustomizingItem(null)} className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
              <div>
                <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-800">Sweetness</h3>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: '0%', label: copy.sugar0 },
                    { value: '25%', label: copy.sugar25 },
                    { value: '50%', label: copy.sugar50 },
                    { value: '75%', label: copy.sugar75 },
                    { value: 'Normal 100%', label: copy.sugar100 },
                    { value: '125%', label: copy.sugar125 },
                  ].map(({ value, label }) => {
                    return (
                      <button
                        key={value}
                        onClick={() => setSweetness(value)}
                        className={`rounded-xl border px-2.5 py-2 text-sm font-bold transition ${sweetness === value ? 'border-[#93c5fd] bg-[#bfdbfe] text-blue-900 shadow-sm' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-800">{copy.sizeLabel}</h3>
                <div className="flex flex-wrap gap-2">
                  {SIZE_OPTIONS.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setSize(option.id)}
                      className={`rounded-xl border px-3 py-2 text-sm font-bold transition ${size === option.id ? 'border-[#93c5fd] bg-[#bfdbfe] text-blue-900 shadow-sm' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
                    >
                      {option.label}{option.upcharge > 0 ? ` +$${option.upcharge.toFixed(2)}` : ''}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-800">Temperature</h3>
                <button
                  type="button"
                  onClick={handleHotToggle}
                  className={`rounded-xl border px-4 py-2 text-sm font-bold transition ${hot ? 'border-[#93c5fd] bg-[#bfdbfe] text-blue-900 shadow-sm' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
                >
                  {copy.hotLabel}
                </button>
                {hot && (
                  <p className="mt-2 text-xs font-medium text-slate-500">{copy.hotHelper}</p>
                )}
              </div>

              <div>
                <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-800">Ice Level</h3>
                <div className="flex flex-wrap gap-2">
                  {['no ice', 'light ice', 'regular ice', 'extra ice'].map(level => (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setIce(level)}
                      disabled={hot}
                      className={`rounded-xl border px-3 py-2 text-sm font-bold transition ${ice === level ? 'border-[#93c5fd] bg-[#bfdbfe] text-blue-900 shadow-sm' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'} ${hot ? 'cursor-not-allowed opacity-60' : ''}`}
                    >
                      {level.charAt(0).toUpperCase() + level.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-800">Toppings (+<span className="tabular-nums">$0.50</span>)</h3>
                <div className="grid grid-cols-2 gap-2">
                  {getToppingOptions().map((topping) => {
                    return (
                      <label key={topping.id} className={`flex cursor-pointer items-center justify-between gap-2 rounded-xl border px-3 py-2 transition ${selectedToppings.includes(topping.name) ? 'border-[#93c5fd] bg-[#eff6ff] ring-1 ring-blue-300' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                        <span className="text-sm font-medium leading-tight text-slate-800">{topping.name}</span>
                        <input
                          type="checkbox"
                          checked={selectedToppings.includes(topping.name)}
                          onChange={() => toggleTopping(topping.name)}
                          className="h-5 w-5 shrink-0 rounded border-slate-300 text-blue-500 focus:ring-blue-400 focus:ring-offset-1"
                        />
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="mt-4 shrink-0">
              <button
                onClick={handleCustomizationConfirm}
                className="w-full rounded-2xl bg-[#93c5fd] py-3 text-lg font-bold text-white shadow-sm transition hover:bg-[#60a5fa] active:scale-[0.98]"
              >
                Add — <span className="tabular-nums">${calculateCustomizedDrinkPrice({
                  basePrice: getBasePrice(customizingItem),
                  toppingCount: selectedToppings.length,
                  sizeId: size,
                }).toFixed(2)}</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
