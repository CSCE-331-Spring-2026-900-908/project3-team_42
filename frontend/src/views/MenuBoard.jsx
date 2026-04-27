import { useState, useEffect } from 'react';
import api from '../api';

export default function MenuBoard() {
  const [weather, setWeather] = useState(null);
  const [menuItems, setMenuItems] = useState([]);

  useEffect(() => {
    api.get('/weather')
      .then(res => setWeather(res.data))
      .catch(err => console.error("Weather fetch error", err));

    api.get('/menu')
      .then(res => {
        if (Array.isArray(res.data)) setMenuItems(res.data);
        else console.error("Invalid menu response:", res.data);
      })
      .catch(err => console.error("Menu fetch error", err));
  }, []);

  const numberedItems = menuItems.map((item, index) => ({ ...item, number: index + 1 }));

  const milkTeas = numberedItems.filter(item => item.category === 'Milk Tea');
  const specialty = numberedItems.filter(item => item.category === 'Specialty');
  const fruitTeas = numberedItems.filter(item => item.category === 'Fruit Tea');
  const matcha = numberedItems.filter(item => item.category === 'Matcha');
  const slushes = numberedItems.filter(item => item.category === 'Slush');

  const ItemRow = ({ item }) => (
    <div key={item.id} className="flex justify-between items-center py-1 border-b border-stone-800/60">
      <div className="flex items-center gap-2">
        <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-stone-500 text-[10px] font-bold text-stone-300">
          {item.number}
        </div>
        <div className="flex flex-col">
          <span className="text-[15px] font-medium tracking-tight text-stone-100">{item.name}</span>
        </div>
      </div>
      <span className="text-[15px] font-black text-orange-400 tabular-nums">${parseFloat(item.default_price).toFixed(2)}</span>
    </div>
  );

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-black font-sans text-stone-100">
      {/* Header section */}
      <header className="flex shrink-0 items-center justify-between border-b-2 border-stone-800 bg-[#0a0a0a] px-8 py-3">
        <div className="flex items-center gap-4">
          <h1 className="text-4xl font-black uppercase tracking-tighter text-teal-500">
            OUR MENU<span className="text-lg text-stone-500 ml-1">®</span>
          </h1>
        </div>
        {weather && (
          <div className="flex items-center gap-4 rounded-xl border border-stone-800 bg-stone-900 px-4 py-2 text-sm font-bold shadow-2xl">
            <img src={weather.icon} alt={weather.shortForecast} className="w-8 h-8 rounded-full border border-stone-700" />
            <span className="text-xl text-orange-200">{weather.temperature}°{weather.unit}</span>
            <div className="h-8 w-[1px] bg-stone-700"></div>
            <div className="flex flex-col">
              <span className="text-stone-300 text-sm">{weather.shortForecast}</span>
              <span className="text-[9px] tracking-widest text-stone-500 uppercase">College Station</span>
            </div>
          </div>
        )}
      </header>

      {/* Main columns */}
      <main id="main-content" className="flex min-h-0 flex-1 px-8 py-4">
        <div className="grid grid-cols-3 gap-8 w-full h-full">
          {/* Column 1: Milky Series & Specialty */}
          <div className="flex flex-col gap-4">
            <section>
              <div className="mb-2 flex items-center border-b-2 border-stone-700 pb-1">
                <h2 className="text-xl font-black uppercase tracking-tight text-white">Milky Series</h2>
              </div>
              <div className="flex flex-col">
                {milkTeas.map(item => <ItemRow key={item.id} item={item} />)}
              </div>
            </section>
            {(specialty.length > 0) && (
              <section>
                <div className="mb-2 flex items-center border-b-2 border-stone-700 pb-1">
                  <h2 className="text-xl font-black uppercase tracking-tight text-white">Fresh Brew & Specialty</h2>
                </div>
                <div className="flex flex-col">
                  {specialty.map(item => <ItemRow key={item.id} item={item} />)}
                </div>
              </section>
            )}
          </div>

          {/* Column 2: Fruity Beverage */}
          <div className="flex flex-col gap-4">
            <section>
              <div className="mb-2 flex items-center border-b-2 border-stone-700 pb-1">
                <h2 className="text-xl font-black uppercase tracking-tight text-white">Fruity Beverage</h2>
              </div>
              <div className="flex flex-col">
                {fruitTeas.map(item => <ItemRow key={item.id} item={item} />)}
              </div>
            </section>
          </div>

          {/* Column 3: Matcha & Ice Blended */}
          <div className="flex flex-col gap-4">
            {(matcha.length > 0) && (
              <section>
                <div className="mb-2 flex items-center border-b-2 border-stone-700 pb-1">
                  <h2 className="text-xl font-black uppercase tracking-tight text-white">New Matcha Series</h2>
                </div>
                <div className="flex flex-col">
                  {matcha.map(item => <ItemRow key={item.id} item={item} />)}
                </div>
              </section>
            )}
            {(slushes.length > 0) && (
              <section>
                <div className="mb-2 flex items-center border-b-2 border-stone-700 pb-1">
                  <h2 className="text-xl font-black uppercase tracking-tight text-white">Ice-Blended</h2>
                </div>
                <div className="flex flex-col">
                  {slushes.map(item => <ItemRow key={item.id} item={item} />)}
                </div>
              </section>
            )}
          </div>
        </div>
      </main>

      {/* Customization Legend Bottom Footer */}
      <footer className="shrink-0 border-t-[3px] border-stone-800 bg-[#0a0a0a] px-12 py-2">
        <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-4 xl:gap-6">
          <div className="flex flex-col gap-1.5 font-medium flex-1 text-xs text-stone-300">
            <div className="flex flex-wrap items-center gap-3">
              <span className="w-36 shrink-0 text-right text-[11px] font-black uppercase tracking-widest text-[#a1a1aa]">Ice Level</span>
              <span>Regular &bull; Less &bull; No Ice</span>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="w-36 shrink-0 text-right text-[11px] font-black uppercase tracking-widest text-[#a1a1aa]">Sweetness Level</span>
              <span className="flex flex-wrap gap-x-2">
                <span>Normal 100% &bull;</span>
                <span>Less 80% &bull;</span>
                <span>Half 50% &bull;</span>
                <span>Light 30% &bull;</span>
                <span>No Sugar 0%</span>
              </span>
            </div>
          </div>

          <div className="flex gap-4 flex-1 xl:justify-end text-xs text-stone-300 mt-1 xl:mt-0">
            <span className="shrink-0 font-black uppercase tracking-widest text-[#a1a1aa] text-[11px]">Topping</span>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 lg:grid-cols-4">
              <span>Pearls (Boba)</span>
              <span>Lychee Jelly</span>
              <span>Crystal Boba</span>
              <span>Ice Cream</span>
              <span>Coffee Jelly</span>
              <span>Honey Jelly</span>
              <span>Mango Popping Boba</span>
              <span>Creama</span>
              <span>Pudding</span>
              <span className="col-span-2">Strawberry Popping Boba</span>
            </div>
          </div>
        </div>
        <p className="mt-3 text-center text-[10px] text-stone-600 uppercase font-semibold">
          Food Allergy Notice: We cannot guarantee that any of our products are free from allergens. (Including dairy, eggs, soy, tree nuts, wheat and others) as we use shared equipment to store, prepare and serve them.
        </p>
      </footer>
    </div>
  );
}
