import { useState, useEffect } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { jwtDecode } from "jwt-decode";
import api from '../api';

export default function Manager() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('inventory');
  const [inventory, setInventory] = useState([]);
  const [inventoryError, setInventoryError] = useState(null);

  useEffect(() => {
    if (!user || activeTab !== 'inventory') return;
    setInventoryError(null);
    api
      .get('/inventory')
      .then((res) => setInventory(res.data))
      .catch((err) => setInventoryError(err.response?.data?.error || err.message || 'Failed to load inventory'));
  }, [user, activeTab]);

  const handleLogin = (credentialResponse) => {
    const decoded = jwtDecode(credentialResponse.credential);
    // Verifying token claims locally for MVP
    if (decoded.email === 'reveille.bubbletea@gmail.com' || decoded.email_verified) {
      setUser(decoded);
    } else {
      alert('Unauthorized email address!');
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center space-y-6">
        <h1 className="text-4xl font-extrabold text-blue-900">Manager Access</h1>
        <p className="text-gray-600 text-lg">Please authenticate with an authorized Google account.</p>
        <div className="bg-white p-8 rounded shadow-lg border-2 border-blue-100 flex justify-center">
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
    <div className="min-h-screen bg-gray-50 flex flex-col items-center">
      <header className="bg-blue-800 text-white w-full p-4 shadow-md flex justify-between items-center px-8">
        <h1 className="text-2xl font-bold">Manager Dashboard</h1>
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-2">
            <img src={user.picture} alt="Profile" className="w-8 h-8 rounded-full" />
            <span className="text-blue-200">Welcome, {user.name}</span>
          </div>
          <button onClick={() => setUser(null)} className="hover:bg-blue-700 px-4 py-2 rounded font-bold bg-blue-600 shadow-sm border border-blue-500 transition">Logout</button>
        </div>
      </header>
      <main className="p-8 w-full max-w-7xl">
        <div className="flex space-x-4 mb-6 border-b pb-4" role="tablist" aria-label="Manager sections">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'inventory'}
            onClick={() => setActiveTab('inventory')}
            className={`px-6 py-2 shadow font-bold rounded ${activeTab === 'inventory' ? 'bg-blue-600 text-white hover:bg-blue-700' : 'text-blue-600 hover:bg-blue-100 bg-white border'}`}
          >
            Inventory
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'menu'}
            onClick={() => setActiveTab('menu')}
            className={`px-6 py-2 shadow-sm font-bold rounded border ${activeTab === 'menu' ? 'bg-blue-600 text-white border-blue-600' : 'text-blue-600 hover:bg-blue-100 bg-white'}`}
          >
            Menu Items
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'financials'}
            onClick={() => setActiveTab('financials')}
            className={`px-6 py-2 shadow-sm font-bold rounded border ${activeTab === 'financials' ? 'bg-blue-600 text-white border-blue-600' : 'text-blue-600 hover:bg-blue-100 bg-white'}`}
          >
            Financials & Users
          </button>
        </div>
        <div className="bg-white p-8 rounded shadow min-h-[500px] border border-gray-200">
          {activeTab === 'inventory' && (
            <>
              <h2 className="text-2xl font-semibold mb-6 text-gray-800">Inventory Overview</h2>
              {inventoryError && (
                <p className="text-red-600 mb-4" role="alert">
                  {inventoryError}
                </p>
              )}
              {!inventoryError && inventory.length === 0 && <p className="text-gray-500">Loading inventory…</p>}
              {inventory.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left border-collapse">
                    <caption className="sr-only">Store inventory quantities and restock thresholds</caption>
                    <thead>
                      <tr className="border-b-2 border-gray-200 bg-gray-50">
                        <th scope="col" className="p-3 font-semibold text-gray-700">
                          Item
                        </th>
                        <th scope="col" className="p-3 font-semibold text-gray-700">
                          Category
                        </th>
                        <th scope="col" className="p-3 font-semibold text-gray-700 text-right">
                          Quantity
                        </th>
                        <th scope="col" className="p-3 font-semibold text-gray-700">
                          Unit
                        </th>
                        <th scope="col" className="p-3 font-semibold text-gray-700 text-right">
                          Restock at
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {inventory.map((row) => (
                        <tr key={row.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="p-3 text-gray-900">{row.name}</td>
                          <td className="p-3 text-gray-600">{row.category || '—'}</td>
                          <td className="p-3 text-right tabular-nums">{Number(row.quantity).toFixed(2)}</td>
                          <td className="p-3 text-gray-600">{row.unit || '—'}</td>
                          <td className="p-3 text-right tabular-nums text-amber-700">{Number(row.restock_threshold).toFixed(2)}</td>
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
              <h2 className="text-2xl font-semibold mb-4 text-gray-800">Menu Items</h2>
              <p className="text-gray-500">Menu editing and pricing tools will be expanded in a later sprint.</p>
            </>
          )}
          {activeTab === 'financials' && (
            <>
              <h2 className="text-2xl font-semibold mb-4 text-gray-800">Financials & Users</h2>
              <p className="text-gray-500">Reports and staff management will be expanded in a later sprint.</p>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
