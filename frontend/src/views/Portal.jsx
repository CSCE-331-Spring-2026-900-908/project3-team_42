import { Link } from 'react-router-dom';

const modes = [
  {
    to: '/manager',
    title: 'Manager',
    subtitle: 'Stock, reports, pricing',
    borderClass: 'border-l-sky-700',
    iconWrap: 'bg-sky-50 text-sky-800',
    icon: (
      <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
        />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    to: '/cashier',
    title: 'Cashier',
    subtitle: 'Ring up orders fast',
    borderClass: 'border-l-emerald-800',
    iconWrap: 'bg-emerald-50 text-emerald-900',
    icon: (
      <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
        />
      </svg>
    ),
  },
  {
    to: '/customer',
    title: 'Kiosk',
    subtitle: 'Guests order on their own',
    borderClass: 'border-l-rose-800',
    iconWrap: 'bg-rose-50 text-rose-900',
    icon: (
      <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"
        />
      </svg>
    ),
  },
  {
    to: '/menuboard',
    title: 'Menu board',
    subtitle: 'Overhead display',
    borderClass: 'border-l-amber-700',
    iconWrap: 'bg-amber-50 text-amber-950',
    icon: (
      <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
        />
      </svg>
    ),
  },
];

export default function Portal() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[var(--color-cream)] font-[family-name:var(--font-ui)] grain">
      <div className="relative z-10 mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-5 py-16 sm:px-8">
        <header className="mb-10 text-center sm:mb-12">
          <p className="label-caps mb-3">In-store</p>
          <h1 className="font-display text-[2.35rem] font-semibold leading-tight tracking-tight text-stone-900 sm:text-5xl">
            Reveille Boba
          </h1>
          <p className="mx-auto mt-4 max-w-md text-[1.05rem] leading-relaxed text-stone-600">
            Choose the layout for this screen. Stations stay separate—there is no link back here.
          </p>
        </header>

        <div className="flex flex-col gap-3 sm:gap-4">
          {modes.map((m) => (
            <Link
              key={m.to}
              to={m.to}
              className={`surface-card group flex border-l-[5px] ${m.borderClass} px-5 py-5 transition hover:-translate-y-px focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-cream)] sm:px-6 sm:py-6`}
            >
              <div className="flex w-full items-start gap-4">
                <span
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${m.iconWrap}`}
                  aria-hidden="true"
                >
                  {m.icon}
                </span>
                <div className="min-w-0 flex-1 text-left">
                  <h2 className="font-display text-xl font-semibold text-stone-900">{m.title}</h2>
                  <p className="mt-1 text-sm leading-snug text-stone-600">{m.subtitle}</p>
                </div>
                <span
                  className="mt-1 hidden text-stone-400 transition group-hover:text-stone-700 sm:block"
                  aria-hidden="true"
                >
                  →
                </span>
              </div>
            </Link>
          ))}
        </div>

        <p className="mt-10 text-center text-xs text-stone-400">Portal · Team 42</p>
      </div>
    </div>
  );
}
