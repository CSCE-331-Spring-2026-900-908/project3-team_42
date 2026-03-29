import { useState, useEffect } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { jwtDecode } from 'jwt-decode';
import api, { getApiErrorMessage } from '../api';

const googleClientConfigured = Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim());

export default function Manager() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('inventory');
  const [inventory, setInventory] = useState([]);
  const [inventoryError, setInventoryError] = useState(null);

  useEffect(() => {
    if (!user || activeTab !== 'inventory') return;

    let cancelled = false;

    api
      .get('/inventory')
      .then((res) => {
        if (!cancelled) {
          setInventory(res.data);
          setInventoryError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setInventoryError(getApiErrorMessage(err, 'Failed to load inventory'));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [user, activeTab]);

  const handleLogin = (credentialResponse) => {
    const decoded = jwtDecode(credentialResponse.credential);
    if (decoded.email === 'reveille.bubbletea@gmail.com' || decoded.email_verified) {
      setUser(decoded);
    } else {
      alert('Unauthorized email address!');
    }
  };

  if (!user) {
    if (!googleClientConfigured) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[var(--color-cream)] px-6 grain">
          <h1 className="font-display text-3xl font-semibold text-stone-900">Manager</h1>
          <p className="max-w-md text-center leading-relaxed text-stone-600">
            Add your Google OAuth web client ID as{' '}
            <code className="rounded bg-stone-200/80 px-1.5 py-0.5 font-mono text-sm text-stone-800">VITE_GOOGLE_CLIENT_ID</code>{' '}
            in <code className="rounded bg-stone-200/80 px-1.5 py-0.5 font-mono text-sm text-stone-800">frontend/.env.local</code>, then restart Vite.
          </p>
        </div>
      );
    }

    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[var(--color-cream)] px-6 grain">
        <h1 className="font-display text-3xl font-semibold text-stone-900">Manager</h1>
        <p className="text-center text-stone-600">Sign in with Google to continue.</p>
        <div className="surface-card rounded-xl p-8">
          <GoogleLogin
            onSuccess={handleLogin}
            onError={() => {
              console.log('Login Failed');
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-100 font-[family-name:var(--font-ui)] grain">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <h1 className="font-display text-xl font-semibold text-stone-900">Back office</h1>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <img src={user.picture} alt="" className="h-8 w-8 rounded-full ring-1 ring-stone-200" />
              <span className="text-sm text-stone-700">{user.name}</span>
            </div>
            <button
              type="button"
              onClick={() => setUser(null)}
              className="rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-800 hover:bg-stone-50"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl p-6 sm:p-8">
        <div className="mb-6 flex flex-wrap gap-2 border-b border-stone-200 pb-4" role="tablist" aria-label="Manager sections">
          {[
            { id: 'inventory', label: 'Inventory' },
            { id: 'menu', label: 'Menu' },
            { id: 'financials', label: 'Reports' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                activeTab === tab.id
                  ? 'bg-stone-900 text-white'
                  : 'text-stone-600 hover:bg-stone-200/60'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="surface-card min-h-[480px] rounded-xl p-6 sm:p-8">
          {activeTab === 'inventory' && (
            <>
              <h2 className="font-display text-xl font-semibold text-stone-900">Inventory</h2>
              {inventoryError && (
                <p className="mt-4 text-red-800" role="alert">
                  {inventoryError}
                </p>
              )}
              {!inventoryError && inventory.length === 0 && <p className="mt-6 text-stone-500">Loading inventory…</p>}
              {inventory.length > 0 && (
                <div className="mt-6 overflow-x-auto">
                  <table className="min-w-full border-collapse text-left text-sm">
                    <caption className="sr-only">Store inventory quantities and restock thresholds</caption>
                    <thead>
                      <tr className="border-b border-stone-200 text-stone-600">
                        <th scope="col" className="pb-3 pr-4 font-medium">
                          Item
                        </th>
                        <th scope="col" className="pb-3 pr-4 font-medium">
                          Category
                        </th>
                        <th scope="col" className="pb-3 pr-4 text-right font-medium">
                          Qty
                        </th>
                        <th scope="col" className="pb-3 pr-4 font-medium">
                          Unit
                        </th>
                        <th scope="col" className="pb-3 text-right font-medium">
                          Restock at
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {inventory.map((row) => (
                        <tr key={row.id} className="border-b border-stone-100 hover:bg-stone-50/80">
                          <td className="py-3 pr-4 text-stone-900">{row.name}</td>
                          <td className="py-3 pr-4 text-stone-600">{row.category || '—'}</td>
                          <td className="py-3 pr-4 text-right tabular-nums text-stone-800">{Number(row.quantity).toFixed(2)}</td>
                          <td className="py-3 pr-4 text-stone-600">{row.unit || '—'}</td>
                          <td className="py-3 text-right tabular-nums text-amber-900/90">{Number(row.restock_threshold).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
          {activeTab === 'menu' && (
            <>
              <h2 className="font-display text-xl font-semibold text-stone-900">Menu</h2>
              <p className="mt-3 text-stone-600">Editing and pricing tools can be added in a later sprint.</p>
            </>
          )}
          {activeTab === 'financials' && (
            <>
              <h2 className="font-display text-xl font-semibold text-stone-900">Reports</h2>
              <p className="mt-3 text-stone-600">Sales and staff reports can be added in a later sprint.</p>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
