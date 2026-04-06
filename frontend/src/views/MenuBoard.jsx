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
      .then(res => setMenuItems(res.data))
      .catch(err => console.error("Menu fetch error", err));
  }, []);

  const milkTeas = menuItems.filter(item => item.category === 'Milk Tea' || item.category === 'Specialty');
  const fruitTeas = menuItems.filter(item => item.category === 'Fruit Tea' || item.category === 'Slush');

  return (
    <div className="min-h-screen bg-black text-white p-8 flex flex-col font-sans">
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <header className="flex flex-col gap-4 border-b-4 border-orange-500 pb-4 mb-12 lg:flex-row lg:justify-between lg:items-end">
        <h1 className="text-5xl font-black text-orange-400 tracking-tight lg:text-7xl">Our Menu</h1>
        <div className="text-xl font-bold flex flex-wrap items-center bg-gray-900 p-4 rounded-2xl text-blue-300 shadow-xl border border-gray-700 lg:text-3xl">
          {weather ? (
            <>
              <img src={weather.icon} alt={weather.shortForecast} className="w-16 h-16 mr-4 rounded-full border-2 border-gray-600" />
              <span className="text-5xl">{weather.temperature}°{weather.unit}</span>
              <div className="flex flex-col ml-4 border-l-2 border-gray-700 pl-4">
                <span className="text-gray-300 truncate max-w-[250px] text-2xl" title={weather.shortForecast}>{weather.shortForecast}</span>
                <span className="text-gray-500 text-xl font-medium tracking-wider uppercase">College Station</span>
              </div>
            </>
          ) : (
            <>
              <span className="mr-4 text-5xl animate-pulse">🌤️</span> 
              <span className="text-gray-400">Loading Weather...</span>
            </>
          )}
        </div>
      </header>
      <main id="main-content" className="flex-1 grid grid-cols-1 gap-16 px-4 lg:grid-cols-2">
        <div className="space-y-8 bg-gray-900 bg-opacity-50 p-8 rounded-3xl border border-gray-800 shadow-2xl">
          <h2 className="text-6xl font-extrabold text-yellow-300 border-b-2 border-gray-600 pb-4 mb-8">Milk Teas & Specials</h2>
          <div className="space-y-6">
            {milkTeas.map(item => (
              <div key={item.id} className="flex justify-between items-center text-4xl border-b border-gray-800 pb-3 border-dashed">
                <div className="flex flex-col">
                  <span className="font-semibold text-gray-100">{item.name}</span>
                </div>
                <span className="font-bold text-gray-300 text-3xl px-4 py-2 bg-gray-800 rounded-lg">${parseFloat(item.default_price).toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-8 bg-gray-900 bg-opacity-50 p-8 rounded-3xl border border-gray-800 shadow-2xl">
          <h2 className="text-6xl font-extrabold text-pink-300 border-b-2 border-gray-600 pb-4 mb-8">Fruit Teas & Slushes</h2>
          <div className="space-y-6">
            {fruitTeas.map(item => (
              <div key={item.id} className="flex justify-between items-center text-4xl border-b border-gray-800 pb-3 border-dashed">
                <span className="font-semibold text-gray-100">{item.name}</span>
                <span className="font-bold text-gray-300 text-3xl px-4 py-2 bg-gray-800 rounded-lg">${parseFloat(item.default_price).toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
