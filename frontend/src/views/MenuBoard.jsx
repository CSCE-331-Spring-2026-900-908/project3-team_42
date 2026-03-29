import { useState, useEffect, useMemo } from 'react';
import api, { getApiErrorMessage } from '../api';

function formatPrice(value) {
  const n = Number.parseFloat(value);
  return (Number.isFinite(n) ? n : 0).toFixed(2);
}

function WeatherLoading() {
  return (
    <div className="flex items-center gap-3 text-stone-400">
      <svg className="h-12 w-12 animate-pulse text-amber-500/50" viewBox="0 0 64 64" fill="none" aria-hidden="true">
        <circle cx="32" cy="32" r="14" stroke="currentColor" strokeWidth="2" />
        <path d="M46 24h4M14 40h4M32 12v4M32 48v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <span className="text-xl font-medium">Loading weather…</span>
    </div>
  );
}

export default function MenuBoard() {
  const [weather, setWeather] = useState(null);
  const [weatherState, setWeatherState] = useState({ status: 'loading', error: null });
  const [menuItems, setMenuItems] = useState([]);
  const [menuState, setMenuState] = useState({ status: 'loading', error: null });

  useEffect(() => {
    let cancelled = false;

    api
      .get('/weather')
      .then((res) => {
        if (!cancelled) {
          setWeather(res.data);
          setWeatherState({ status: 'ok', error: null });
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setWeatherState({ status: 'error', error: getApiErrorMessage(err, 'Weather unavailable') });
        }
      });

    api
      .get('/menu')
      .then((res) => {
        if (!cancelled) {
          setMenuItems(res.data);
          setMenuState({ status: 'ok', error: null });
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setMenuState({ status: 'error', error: getApiErrorMessage(err, 'Could not load menu') });
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const milkTeas = useMemo(
    () => menuItems.filter((item) => item.category === 'Milk Tea' || item.category === 'Specialty'),
    [menuItems]
  );
  const fruitTeas = useMemo(
    () => menuItems.filter((item) => item.category === 'Fruit Tea' || item.category === 'Slush'),
    [menuItems]
  );

  const weatherWidget = () => {
    if (weatherState.status === 'loading') {
      return <WeatherLoading />;
    }
    if (weatherState.status === 'error') {
      return (
        <span className="text-lg text-stone-500" title={weatherState.error}>
          Weather unavailable
        </span>
      );
    }
    if (weather) {
      return (
        <>
          <img
            src={weather.icon}
            alt={weather.shortForecast || ''}
            className="h-16 w-16 shrink-0 rounded-full border-2 border-stone-600"
          />
          <span className="font-display text-5xl font-semibold tabular-nums text-white">
            {weather.temperature}°{weather.unit}
          </span>
          <div className="ml-4 flex min-w-0 flex-col border-l-2 border-stone-600 pl-4">
            <span className="truncate text-xl text-stone-300" title={weather.shortForecast}>
              {weather.shortForecast}
            </span>
            <span className="text-sm font-medium uppercase tracking-widest text-stone-500">College Station</span>
          </div>
        </>
      );
    }
    return null;
  };

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 p-6 font-[family-name:var(--font-ui)] text-white sm:p-10">
      <header className="mb-10 flex flex-col gap-6 border-b border-stone-700 pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-500/90">Reveille Boba</p>
          <h1 className="font-display text-5xl font-semibold tracking-tight text-amber-100 sm:text-6xl lg:text-7xl">
            Menu
          </h1>
        </div>
        <div className="flex min-h-[5rem] items-center rounded-2xl border border-stone-700 bg-stone-900/80 px-5 py-3">
          {weatherWidget()}
        </div>
      </header>

      {menuState.status === 'error' && (
        <div className="mb-8 rounded-xl border border-red-900/80 bg-red-950/50 px-5 py-4 text-red-200" role="alert">
          {menuState.error}
        </div>
      )}

      <main className="grid flex-1 grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-14">
        <div className="rounded-2xl border border-stone-800 bg-stone-900/40 p-6 sm:p-8">
          <h2 className="font-display border-b border-stone-700 pb-4 text-3xl font-semibold text-amber-100 sm:text-4xl lg:text-5xl">
            Milk teas &amp; specials
          </h2>
          <div className="mt-6 space-y-4">
            {menuState.status === 'loading' && menuItems.length === 0 && (
              <p className="text-xl text-stone-500">Loading…</p>
            )}
            {menuState.status === 'ok' && milkTeas.length === 0 && (
              <p className="text-xl text-stone-500">No items in this section.</p>
            )}
            {milkTeas.map((item) => (
              <div
                key={item.id}
                className="flex items-baseline justify-between gap-4 border-b border-dashed border-stone-700 pb-4 text-left last:border-0"
              >
                <span className="min-w-0 flex-1 font-medium leading-tight text-stone-100 sm:text-2xl lg:text-3xl">
                  {item.name}
                </span>
                <span className="shrink-0 rounded-lg bg-stone-800 px-3 py-1.5 font-display text-xl font-semibold tabular-nums text-amber-100 sm:text-2xl">
                  ${formatPrice(item.default_price)}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-stone-800 bg-stone-900/40 p-6 sm:p-8">
          <h2 className="font-display border-b border-stone-700 pb-4 text-3xl font-semibold text-rose-100 sm:text-4xl lg:text-5xl">
            Fruit teas &amp; slushes
          </h2>
          <div className="mt-6 space-y-4">
            {menuState.status === 'loading' && menuItems.length === 0 && (
              <p className="text-xl text-stone-500">Loading…</p>
            )}
            {menuState.status === 'ok' && fruitTeas.length === 0 && (
              <p className="text-xl text-stone-500">No items in this section.</p>
            )}
            {fruitTeas.map((item) => (
              <div
                key={item.id}
                className="flex items-baseline justify-between gap-4 border-b border-dashed border-stone-700 pb-4 text-left last:border-0"
              >
                <span className="min-w-0 flex-1 font-medium leading-tight text-stone-100 sm:text-2xl lg:text-3xl">
                  {item.name}
                </span>
                <span className="shrink-0 rounded-lg bg-stone-800 px-3 py-1.5 font-display text-xl font-semibold tabular-nums text-rose-100 sm:text-2xl">
                  ${formatPrice(item.default_price)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
