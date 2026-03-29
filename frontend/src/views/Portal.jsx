import { Link } from 'react-router-dom';

const modes = [
  {
    to: '/manager',
    title: 'Manager',
    subtitle: 'Inventory, staff tools, reports',
    gradient: 'from-sky-600 to-blue-700',
    icon: (
      <svg className="h-10 w-10 opacity-90" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    to: '/cashier',
    title: 'Cashier POS',
    subtitle: 'Fast lane — tap, review, send',
    gradient: 'from-teal-600 to-emerald-800',
    icon: (
      <svg className="h-10 w-10 opacity-90" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
      </svg>
    ),
  },
  {
    to: '/customer',
    title: 'Customer Kiosk',
    subtitle: 'Self-order with assist & translate',
    gradient: 'from-violet-600 to-fuchsia-700',
    icon: (
      <svg className="h-10 w-10 opacity-90" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    to: '/menuboard',
    title: 'Menu Board',
    subtitle: 'Overhead display — read-only',
    gradient: 'from-amber-600 to-orange-700',
    icon: (
      <svg className="h-10 w-10 opacity-90" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
  },
];

export default function Portal() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#fffbf7] font-[family-name:var(--font-ui)]">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(167,139,250,0.18),transparent),radial-gradient(ellipse_60%_40%_at_100%_50%,rgba(45,212,191,0.12),transparent),radial-gradient(ellipse_50%_30%_at_0%_80%,rgba(251,191,36,0.1),transparent)]"
        aria-hidden="true"
      />
      <div className="relative z-10 mx-auto flex min-h-screen max-w-5xl flex-col justify-center px-5 py-14 sm:px-8">
        <header className="mb-12 text-center sm:mb-16">
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-stone-500">Team 42 · In-store hub</p>
          <h1 className="font-display text-4xl font-bold tracking-tight text-stone-900 sm:text-5xl">
            Reveille Boba
          </h1>
          <p className="mx-auto mt-4 max-w-lg text-lg text-stone-600">
            Choose a station. Each interface is separate — pick the role that matches the screen in front of you.
          </p>
        </header>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          {modes.map((m) => (
            <Link
              key={m.to}
              to={m.to}
              className={`group relative overflow-hidden rounded-2xl bg-gradient-to-br p-8 text-white shadow-lg shadow-stone-900/10 ring-1 ring-white/10 transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-stone-900/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-2 focus-visible:ring-offset-[#fffbf7] ${m.gradient}`}
            >
              <div className="absolute -right-6 -top-6 h-32 w-32 rounded-full bg-white/10 blur-2xl transition group-hover:bg-white/15" aria-hidden="true" />
              <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <span className="rounded-xl bg-black/15 p-3 ring-1 ring-white/20">{m.icon}</span>
                <div className="flex-1 text-left">
                  <h2 className="font-display text-2xl font-bold">{m.title}</h2>
                  <p className="mt-2 text-sm font-medium text-white/85">{m.subtitle}</p>
                </div>
                <span
                  className="hidden text-2xl text-white/40 transition group-hover:text-white/90 sm:block"
                  aria-hidden="true"
                >
                  →
                </span>
              </div>
            </Link>
          ))}
        </div>

        <p className="mt-12 text-center text-xs text-stone-400">
          Portal only — opened interfaces do not link back here.
        </p>
      </div>
    </div>
  );
}
