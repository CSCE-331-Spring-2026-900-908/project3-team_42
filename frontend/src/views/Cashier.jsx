import { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

export default function Cashier() {
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pinEntry, setPinEntry] = useState('');
  
  const [menuItems, setMenuItems] = useState([]);
  const [cart, setCart] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const cashierId = 2;

  useEffect(() => {
    api.get('/menu').then((res) => {
      if (Array.isArray(res.data)) setMenuItems(res.data);
      else console.error("Invalid menu response:", res.data);
    }).catch(console.error);
  }, []);

  const categories = useMemo(() => {
    const cats = new Set(menuItems.map(item => item.category || 'Specialty'));
    return ['All', ...cats];
  }, [menuItems]);

  const displayedItems = useMemo(() => {
    if (selectedCategory === 'All') return menuItems;
    return menuItems.filter(item => (item.category || 'Specialty') === selectedCategory);
  }, [menuItems, selectedCategory]);

  const handlePinClick = (val) => {
    if (val === 'Clear') setPinEntry('');
    else if (val === 'Del') setPinEntry(prev => prev.slice(0, -1));
    else if (pinEntry.length < 4) setPinEntry(prev => prev + val);
  };

  const handleLogin = () => {
    if (pinEntry === '1234') setIsAuthenticated(true);
    else {
      alert("Invalid PIN. Use 1234.");
      setPinEntry('');
    }
  };

  const [customizingItem, setCustomizingItem] = useState(null);
  const [sweetness, setSweetness] = useState('100');
  const [ice, setIce] = useState('regular ice');
  const [toppings, setToppings] = useState([]);

  const TOPPING_OPTIONS = [
    { id: 'boba', name: 'Boba (+0.50)', price: 0.50 },
    { id: 'lychee_jelly', name: 'Lychee Jelly (+0.50)', price: 0.50 },
    { id: 'pudding', name: 'Pudding (+0.50)', price: 0.50 }
  ];

  const handleDrinkClick = (item) => {
    setCustomizingItem(item);
    setSweetness('100');
    setIce('regular ice');
    setToppings([]);
  };

  const toggleTopping = (id) => {
    setToppings((prev) => 
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  };

  const confirmCustomization = () => {
    const basePrice = parseFloat(customizingItem.default_price);
    const toppingsPrice = toppings.length * 0.50;
    const customPrice = basePrice + toppingsPrice;
    
    const toppingNames = toppings.map(tid => TOPPING_OPTIONS.find(o => o.id === tid)?.name.split(' ')[0]);

    const customization = {
      sweetness: `${sweetness}%`,
      ice: ice,
      toppings: toppingNames
    };

    setCart((prev) => [
      ...prev, 
      { 
        ...customizingItem, 
        unique_id: Date.now(), 
        quantity: 1, 
        customization,
        custom_price: customPrice
      }
    ]);
    setCustomizingItem(null);
  };

  const incrementLine = (unique_id) => {
    setCart((prev) => prev.map((line) => {
      if (line.unique_id === unique_id) {
        return { ...line, quantity: line.quantity + 1 };
      }
      return line;
    }));
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

    const total_amount = cart.reduce((sum, item) => sum + (item.custom_price ?? parseFloat(item.default_price)) * item.quantity, 0);

    try {
      const formattedItems = cart.map((i) => ({
        menu_item_id: i.id,
        quantity: i.quantity,
        customization: i.customization,
        price: i.custom_price ?? i.default_price,
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

  const subtotal = cart.reduce((sum, item) => sum + (item.custom_price ?? parseFloat(item.default_price)) * item.quantity, 0);
  const tax = subtotal * 0.0825; // 8.25% TX Tax approx
  const total = subtotal + tax;

  if (!isAuthenticated) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#f3f4f6]">
        <div className="w-[420px] rounded-[30px] bg-white p-10 shadow-lg">
          <h1 className="text-[32px] font-bold text-[#111827]">Boba POS Login</h1>
          <p className="mt-2 text-[18px] text-[#6b7280]">Enter 4-digit PIN (Cashier)</p>
          
          <div className="my-8 flex justify-center gap-4">
            {[0, 1, 2, 3].map(i => (
              <div 
                key={i} 
                className={`h-5 w-5 rounded-full border-2 ${i < pinEntry.length ? 'border-stone-800 bg-stone-800' : 'border-[#9ca3af] bg-transparent'}`}
              ></div>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-4 mb-6">
            {[1,2,3,4,5,6,7,8,9].map(num => (
              <button 
                key={num} 
                onClick={() => handlePinClick(num.toString())}
                className="h-16 rounded-xl bg-[#f3f4f6] text-[22px] font-medium text-[#111827] transition hover:bg-[#e5e7eb] active:scale-95"
              >
                {num}
              </button>
            ))}
            <button 
              onClick={() => handlePinClick('Clear')}
              className="h-16 rounded-xl bg-[#f3f4f6] text-[18px] font-medium text-[#111827] transition hover:bg-[#e5e7eb] active:scale-95"
            >
              Clear
            </button>
            <button 
              onClick={() => handlePinClick('0')}
              className="h-16 rounded-xl bg-[#f3f4f6] text-[22px] font-medium text-[#111827] transition hover:bg-[#e5e7eb] active:scale-95"
            >
              0
            </button>
            <button 
              onClick={() => handlePinClick('Del')}
              className="h-16 rounded-xl bg-[#f3f4f6] text-[18px] font-medium text-[#111827] transition hover:bg-[#e5e7eb] active:scale-95"
            >
              Del
            </button>
          </div>

          <button 
            onClick={handleLogin}
            className="w-full h-14 rounded-xl bg-[#93c5fd] text-xl font-bold text-white transition hover:bg-[#60a5fa] active:scale-95"
          >
            Continue
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-800 overflow-hidden">
      
      {/* Left Main Interface */}
      <div className="flex-1 flex flex-col p-4 mr-4">
        
        {/* Header with Title and Category Filter */}
        <header className="mb-4">
          <div className="flex items-center gap-4 mb-3">
            <button 
              onClick={() => navigate(-1)} 
              className="flex items-center justify-center p-2 rounded-full hover:bg-slate-200 transition"
              aria-label="Back"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">Menu</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`rounded-full px-5 py-2 text-sm font-semibold transition ${selectedCategory === cat ? 'bg-slate-900 text-white shadow-sm' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
              >
                {cat}
              </button>
            ))}
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto pb-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3 shrink-0">
            {displayedItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleDrinkClick(item)}
                className="flex flex-col items-center justify-center min-h-[130px] rounded-xl border border-slate-200 bg-white p-3 text-center transition hover:border-[#93c5fd] hover:shadow-md active:scale-95"
              >
                <span className="text-[15px] font-bold leading-tight text-slate-800">
                  {item.name}
                </span>
                <span className="mt-1.5 text-sm font-medium text-slate-500">
                  ${parseFloat(item.default_price).toFixed(2)}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Right Sidebar Cart Section */}
      <aside className="w-[420px] flex shrink-0 flex-col border-l border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-6">
          <h2 className="text-2xl font-bold text-slate-900">Current Order</h2>
        </div>

        <div className="flex-1 overflow-y-auto p-6 relative">
          {cart.length === 0 ? (
            <div className="flex h-full items-center justify-center -mt-10">
              <p className="font-medium text-slate-400">No items added yet.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {cart.map((item) => (
                <div key={item.unique_id} className="flex flex-col">
                  <div className="flex justify-between items-start font-bold text-slate-800 text-[15px]">
                    <span className="w-2/3 pr-2 leading-tight">{item.name}</span>
                    <span>${(item.custom_price ?? parseFloat(item.default_price)).toFixed(2)}</span>
                  </div>
                  {item.customization && (
                    <div className="text-xs text-slate-500 mt-1 leading-relaxed">
                      S: {item.customization.sweetness} | I: {item.customization.ice}
                      {item.customization.toppings?.length > 0 && ` | +${item.customization.toppings.join(', ')}`}
                    </div>
                  )}
                  <div className="mt-2 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <button onClick={() => decrementLine(item.unique_id)} className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-100 text-lg font-bold text-slate-600 hover:bg-slate-200">−</button>
                      <span className="font-bold tabular-nums text-slate-800">{item.quantity}</span>
                      <button onClick={() => incrementLine(item.unique_id)} className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-100 text-lg font-bold text-slate-600 hover:bg-slate-200">+</button>
                    </div>
                    <button onClick={() => removeLine(item.unique_id)} className="text-sm font-bold text-red-400 hover:text-red-500 transition">Remove</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-6 shrink-0 bg-white">
          <div className="space-y-3 pt-1">
            <div className="flex justify-between text-[15px] font-medium text-slate-600">
              <span>Subtotal</span>
              <span>${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-[15px] font-medium text-slate-600">
              <span>Tax</span>
              <span>${tax.toFixed(2)}</span>
            </div>
          </div>
          
          <div className="mt-4 border-t border-slate-200 pt-4 flex justify-between text-2xl font-black text-slate-900">
            <span>Total</span>
            <span>${total.toFixed(2)}</span>
          </div>

          <button
            onClick={handleCheckout}
            disabled={cart.length === 0}
            className="w-full mt-6 rounded bg-[#94a3b8] py-4 text-xl font-bold text-white transition hover:bg-[#64748b] disabled:opacity-50 disabled:hover:bg-[#94a3b8]"
          >
            Submit Order
          </button>
        </div>
      </aside>

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
                  {['0', '25', '50', '75', '100'].map(level => (
                    <button
                      key={level}
                      onClick={() => setSweetness(level)}
                      className={`min-w-[3.5rem] rounded-xl border px-3 py-2 text-sm font-bold transition ${sweetness === level ? 'border-[#93c5fd] bg-[#bfdbfe] text-blue-900 shadow-sm' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
                    >
                      {level}%
                    </button>
                  ))}
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
                  {TOPPING_OPTIONS.map(topping => (
                    <label key={topping.id} className={`flex cursor-pointer items-center justify-between rounded-xl border p-3 transition ${toppings.includes(topping.id) ? 'border-[#93c5fd] bg-[#eff6ff] ring-1 ring-blue-300' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                      <span className="font-medium text-slate-800">{topping.name.replace(' (+0.50)', '')}</span>
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={toppings.includes(topping.id)}
                          onChange={() => toggleTopping(topping.id)}
                          className="h-5 w-5 rounded border-slate-300 text-blue-500 focus:ring-blue-400 focus:ring-offset-1"
                        />
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-8">
              <button
                onClick={confirmCustomization}
                className="w-full rounded-2xl bg-[#93c5fd] py-4 text-lg font-bold text-white shadow-sm transition hover:bg-[#60a5fa] active:scale-[0.98]"
              >
                Add — <span className="tabular-nums">${(parseFloat(customizingItem.default_price) + toppings.length * 0.50).toFixed(2)}</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
