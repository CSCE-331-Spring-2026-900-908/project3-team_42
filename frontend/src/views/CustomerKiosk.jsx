import { useState, useEffect, useRef } from 'react';
import api from '../api';

/** Matches seed user `Self-Service Kiosk` (third row in users). */
const KIOSK_CASHIER_ID = 3;

export default function CustomerKiosk() {
  const [menuItems, setMenuItems] = useState([]);
  const [cart, setCart] = useState([]);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [language, setLanguage] = useState('en');
  const [isTranslating, setIsTranslating] = useState(false);
  
  // Chatbot State
  const [chatOpen, setChatOpen] = useState(false);
  const [chatLog, setChatLog] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatting, setIsChatting] = useState(false);
  const chatEndRef = useRef(null);
  
  const [copy, setCopy] = useState({
    welcome: "Welcome to Bubble Tea!",
    translateBtn: "Translate to Spanish",
    addToOrder: "Add to Order",
    total: "Total:",
    checkout: "Checkout & Pay"
  });

  useEffect(() => {
    api.get('/menu').then(res => setMenuItems(res.data)).catch(console.error);
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatLog, isChatting]);

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
        const [w, a, t, c] = await Promise.all([
          translateText(copy.welcome, 'es'),
          translateText(copy.addToOrder, 'es'),
          translateText(copy.total, 'es'),
          translateText(copy.checkout, 'es')
        ]);
        
        const translatedMenu = await Promise.all(menuItems.map(async item => {
          return {
             ...item,
             name: await translateText(item.name, 'es'),
             description: await translateText(item.description, 'es')
          }
        }));
        setMenuItems(translatedMenu);

        setCopy({
          welcome: w,
          translateBtn: "Traducir al Inglés",
          addToOrder: "Añadir al Pedido",
          total: t,
          checkout: c
        });
      } catch (err) {
        console.error("Translation failed", err);
      }
    } else {
      const res = await api.get('/menu');
      setMenuItems(res.data);
      setCopy({
        welcome: "Welcome to Bubble Tea!",
        translateBtn: "Translate to Spanish",
        addToOrder: "Add to Order",
        total: "Total:",
        checkout: "Checkout & Pay"
      });
    }
    
    setLanguage(targetLang);
    setIsTranslating(false);
  };

  const handleChatSubmit = async (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    
    const userMsg = chatInput;
    setChatLog(prev => [...prev, { sender: 'user', text: userMsg }]);
    setChatInput('');
    setIsChatting(true);
    
    try {
      const menuContext = menuItems.map(i => `${i.name}: ${i.description} ($${i.default_price})`).join('; ');
      const res = await api.post('/chat', { message: userMsg, menuContext, language });
      setChatLog(prev => [...prev, { sender: 'ai', text: res.data.reply }]);
    } catch (err) {
      setChatLog(prev => [...prev, { sender: 'ai', text: "Sorry, I'm having trouble connecting." }]);
    }
    setIsChatting(false);
  };

  const addToCart = (item) => {
    setCart((prev) => [...prev, { ...item, unique_id: Date.now(), quantity: 1 }]);
  };

  const removeFromCart = (unique_id) => {
    setCart((prev) => prev.filter((line) => line.unique_id !== unique_id));
  };

  const cartTotal = cart.reduce((sum, line) => sum + parseFloat(line.default_price) * line.quantity, 0);

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    setCheckoutLoading(true);
    const total_amount = cartTotal;
    const formattedItems = cart.map((i) => ({
      menu_item_id: i.id,
      quantity: i.quantity,
      customization: null,
      price: i.default_price
    }));
    try {
      const res = await api.post('/orders', {
        cashier_id: KIOSK_CASHIER_ID,
        total_amount,
        items: formattedItems
      });
      alert(`${res.data.message} (Order #${res.data.id})`);
      setCart([]);
    } catch (err) {
      alert(language === 'es' ? 'No se pudo completar el pago.' : 'Checkout failed. Please try again.');
      console.error(err);
    }
    setCheckoutLoading(false);
  };

  const mainPadBottom = cart.length > 0 ? 'pb-56' : 'pb-40';

  return (
    <div className="min-h-screen bg-purple-50 flex flex-col font-sans relative">
      <header className="bg-purple-900 text-white p-6 text-center text-3xl font-extrabold shadow-md flex justify-between items-center z-20">
        <span>{copy.welcome}</span>
        <button 
          onClick={handleTranslateToggle}
          disabled={isTranslating}
          className="bg-purple-700 px-6 py-3 min-w-[300px] rounded-lg text-2xl border-2 border-purple-500 hover:bg-purple-600 disabled:opacity-50 cursor-pointer focus:ring-4 ring-white shadow-sm transition">
          {isTranslating ? '...' : copy.translateBtn}
        </button>
      </header>
      
      <main className={`flex-1 p-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 overflow-y-auto ${mainPadBottom} z-10`}>
        {menuItems.map(item => (
          <div key={item.id} className="bg-white p-8 rounded-2xl shadow-xl border-4 border-purple-100 flex flex-col items-center">
            {item.image_url ? 
              <img src={item.image_url} alt={item.name} className="w-56 h-56 object-cover rounded-full mb-6 shadow-md border-4 border-purple-50" /> 
              : <div className="w-56 h-56 bg-gray-200 rounded-full mb-6 flex items-center justify-center text-gray-400 font-bold text-2xl shadow" aria-hidden="true">No Image</div>
            }
            <h2 className="text-4xl font-black text-center mb-3 text-purple-900 leading-tight">{item.name}</h2>
            <p className="text-center text-gray-600 text-xl mb-6 line-clamp-3 leading-relaxed">{item.description}</p>
            <div className="text-3xl font-extrabold text-purple-800 mb-6 bg-purple-50 px-6 py-2 rounded-xl border border-purple-100" aria-label={`${language === 'es' ? 'Precio' : 'Price'} ${parseFloat(item.default_price).toFixed(2)} dollars`}>
              ${parseFloat(item.default_price).toFixed(2)}
            </div>
            <button
              type="button"
              onClick={() => addToCart(item)}
              className="mt-auto w-full bg-purple-600 text-white text-3xl py-6 rounded-xl font-bold cursor-pointer hover:bg-purple-700 transition-colors focus:ring-4 ring-purple-300 shadow-md min-h-[56px] min-w-[56px]"
              aria-label={`${copy.addToOrder}: ${item.name}`}
            >
              {copy.addToOrder}
            </button>
          </div>
        ))}
      </main>

      {cart.length > 0 && (
        <div
          className="fixed bottom-32 left-0 right-0 z-20 max-h-36 overflow-y-auto border-t border-purple-200 bg-white/95 px-6 py-3 shadow-md backdrop-blur-sm"
          aria-label={language === 'es' ? 'Artículos en el carrito' : 'Items in your order'}
        >
          <ul className="mx-auto flex max-w-5xl flex-col gap-2">
            {cart.map((line) => (
              <li key={line.unique_id} className="flex items-center justify-between gap-4 text-lg text-gray-800">
                <span className="truncate font-semibold">
                  {line.name}{' '}
                  <span className="font-normal text-gray-600">
                    (${parseFloat(line.default_price).toFixed(2)})
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => removeFromCart(line.unique_id)}
                  className="shrink-0 rounded-lg bg-red-50 px-4 py-2 text-base font-bold text-red-600 hover:bg-red-100 focus:ring-2 focus:ring-red-300"
                  aria-label={language === 'es' ? `Quitar ${line.name}` : `Remove ${line.name}`}
                >
                  {language === 'es' ? 'Quitar' : 'Remove'}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Floating Chat Assistant */}
      <div className={`fixed bottom-40 right-8 w-[450px] bg-white rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] border-4 border-purple-300 flex flex-col transition-transform z-50 origin-bottom-right ${chatOpen ? 'scale-100' : 'scale-0'}`}>
        <div className="bg-gradient-to-r from-purple-800 to-purple-600 text-white p-6 rounded-t-2xl flex justify-between items-center shadow-md">
          <span className="font-extrabold text-2xl flex items-center">✨ Boba Assistant</span>
          <button onClick={() => setChatOpen(false)} className="text-purple-200 hover:text-white cursor-pointer text-3xl px-2">✕</button>
        </div>
        <div className="h-96 overflow-y-auto p-5 space-y-4 bg-purple-50 flex flex-col">
          {chatLog.length === 0 && <p className="text-purple-400 text-center italic mt-10 font-bold text-xl">Hi! Ask me anything about our Bubble Tea menu!</p>}
          {chatLog.map((msg, i) => (
            <div key={i} className={`p-4 rounded-3xl max-w-[85%] text-[1.1rem] leading-relaxed shadow-sm flex flex-col ${msg.sender === 'user' ? 'bg-purple-600 text-white self-end rounded-br-sm' : 'bg-white border-2 border-purple-100 text-gray-800 self-start rounded-bl-sm'}`}>
              <span dangerouslySetInnerHTML={{ __html: msg.text.replace(/\n/g, '<br/>') }} />
            </div>
          ))}
          {isChatting && <div className="text-purple-400 italic text-[1.1rem] font-bold animate-pulse ml-2 bg-purple-100 self-start p-3 rounded-2xl rounded-bl-sm border border-purple-200 shadow-sm">Typing...</div>}
          <div ref={chatEndRef} />
        </div>
        <form onSubmit={handleChatSubmit} className="p-5 bg-white border-t border-purple-200 flex rounded-b-2xl shadow-[0_-4px_10px_rgba(0,0,0,0.05)]">
          <input 
            type="text" 
            value={chatInput} 
            onChange={e => setChatInput(e.target.value)}
            className="flex-1 bg-gray-100 rounded-2xl px-5 py-4 outline-none focus:ring-4 ring-purple-300 text-[1.1rem] border-2 border-transparent transition"
            placeholder="What does Taro taste like...?" 
          />
          <button disabled={isChatting} type="submit" className="ml-3 bg-purple-600 hover:bg-purple-700 transition-colors text-white px-8 rounded-2xl font-bold text-xl cursor-pointer disabled:opacity-50">Ask</button>
        </form>
      </div>

      <button 
        onClick={() => setChatOpen(!chatOpen)}
        className={`fixed bottom-40 right-8 bg-purple-700 text-white w-24 h-24 rounded-full shadow-[0_10px_30px_rgba(0,0,0,0.5)] flex items-center justify-center text-5xl hover:scale-110 active:scale-95 transition-transform cursor-pointer border-4 border-purple-300 z-40 ${chatOpen ? 'scale-0' : 'scale-100'}`}>
        ✨
      </button>

      <div className="fixed bottom-0 z-30 flex w-full items-center justify-between bg-white p-8 shadow-[0_-10px_20px_-5px_rgba(0,0,0,0.2)]">
        <div
          className="text-5xl font-black tracking-tight text-purple-900 sm:text-6xl"
          aria-live="polite"
          aria-atomic="true"
        >
          {copy.total} ${cartTotal.toFixed(2)}
        </div>
        <button
          type="button"
          onClick={handleCheckout}
          disabled={cart.length === 0 || checkoutLoading}
          className="min-h-[56px] rounded-3xl border-b-[10px] border-purple-900 bg-purple-600 px-12 py-8 text-3xl font-black text-white shadow-xl transition hover:bg-purple-700 focus:ring-4 focus:ring-purple-300 active:translate-y-2 active:border-b-0 disabled:cursor-not-allowed disabled:opacity-50 sm:px-20 sm:text-4xl"
          aria-label={copy.checkout}
        >
          {checkoutLoading ? '…' : copy.checkout}
        </button>
      </div>
    </div>
  );
}
