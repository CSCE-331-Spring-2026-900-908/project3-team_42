import { useEffect, useMemo, useState } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { jwtDecode } from 'jwt-decode';
import api from '../api';
import Modal from '../components/manager/Modal';
import {
  DonutChart,
  HorizontalBarChart,
  LineChartCategory,
  VerticalBarChart,
} from '../components/manager/SvgCharts';

function toISODate(d) {
  const dt = new Date(d);
  return dt.toISOString().slice(0, 10);
}

function daysAgoStr(days) {
  const dt = new Date();
  dt.setDate(dt.getDate() - days);
  return toISODate(dt);
}

function formatCurrency(n) {
  const num = Number(n || 0);
  return `$${num.toFixed(2)}`;
}

export default function Manager() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('reports'); // mirrors Project 2 "reports first" UX
  const [inventory, setInventory] = useState([]);
  const [inventoryError, setInventoryError] = useState(null);

  // Reports tab
  const [reportTab, setReportTab] = useState('productUsage'); // productUsage | xReport | zReport | salesReport
  const todayStr = useMemo(() => toISODate(new Date()), []);
  const defaultFrom = useMemo(() => daysAgoStr(7), []);
  const [rangeFrom, setRangeFrom] = useState(defaultFrom);
  const [rangeTo, setRangeTo] = useState(todayStr);
  const [signature, setSignature] = useState('');
  const [feedback, setFeedback] = useState('');

  const [modal, setModal] = useState({
    open: false,
    title: '',
    kind: null, // productUsage | xReport | salesReport | zReport
    loading: false,
    error: null,
    data: null,
  });

  useEffect(() => {
    if (!user || activeTab !== 'inventory') return;
    setInventoryError(null);
    api
      .get('/inventory')
      .then((res) => setInventory(res.data))
      .catch((err) => {
        setInventoryError(err.response?.data?.error || err.message || 'Failed to load inventory');
      });
  }, [user, activeTab]);

  useEffect(() => {
    // Keep UX tight: when switching report tabs, clear messages and close modals.
    setFeedback('');
    setModal((m) => ({ ...m, open: false, loading: false, error: null, data: null }));
  }, [reportTab]);

  const handleLogin = (credentialResponse) => {
    const decoded = jwtDecode(credentialResponse.credential);
    // Verifying token claims locally for MVP
    if (decoded.email === 'reveille.bubbletea@gmail.com' || decoded.email_verified) {
      setUser(decoded);
    } else {
      alert('Unauthorized email address!');
    }
  };

  const isValidRange = (from, to) => {
    if (!from || !to) return false;
    // ISO format lets us use string comparison for dates.
    return from <= to;
  };

  const openModal = (title, kind) => {
    setModal({
      open: true,
      title,
      kind,
      loading: true,
      error: null,
      data: null,
    });
  };

  const setModalError = (err) => {
    const msg = err?.response?.data?.error || err?.message || 'Request failed';
    setModal((m) => ({ ...m, loading: false, error: msg }));
  };

  const openProductUsage = () => {
    if (!isValidRange(rangeFrom, rangeTo)) {
      setFeedback('Please choose a valid date range.');
      return;
    }
    setFeedback('');
    openModal(`Product Usage — ${rangeFrom} to ${rangeTo}`, 'productUsage');
    api
      .get('/reports/product-usage', { params: { from: rangeFrom, to: rangeTo } })
      .then((res) => {
        const points = res.data?.points || [];
        setModal({ open: true, title: `Product Usage — ${rangeFrom} to ${rangeTo}`, kind: 'productUsage', loading: false, error: null, data: { points } });
        setFeedback(points.length === 0 ? 'No usage data in selected window.' : 'Graph opened.');
      })
      .catch(setModalError);
  };

  const openXReport = () => {
    setFeedback('');
    openModal('X-Report (Hourly Sales)', 'xReport');
    api
      .get('/reports/x')
      .then((res) => {
        setModal({ open: true, title: 'X-Report (Hourly Sales)', kind: 'xReport', loading: false, error: null, data: res.data });
        const hours = res.data?.hours || [];
        setFeedback(hours.some((h) => Number(h.salesAmount) > 0) ? 'Chart opened.' : 'No hourly sales data yet.');
      })
      .catch(setModalError);
  };

  const openSalesByItem = () => {
    if (!isValidRange(rangeFrom, rangeTo)) {
      setFeedback('Please choose a valid date range.');
      return;
    }
    setFeedback('');
    openModal(`Sales by Item — ${rangeFrom} to ${rangeTo}`, 'salesReport');
    api
      .get('/reports/sales-by-item', { params: { from: rangeFrom, to: rangeTo } })
      .then((res) => {
        const items = res.data?.items || [];
        setModal({
          open: true,
          title: `Sales by Item — ${rangeFrom} to ${rangeTo}`,
          kind: 'salesReport',
          loading: false,
          error: null,
          data: { items },
        });
        setFeedback(items.length === 0 ? 'No sales in selected window.' : 'Report opened.');
      })
      .catch(setModalError);
  };

  const runZReport = () => {
    setFeedback('');
    openModal('Z-Report Summary', 'zReport');
    api
      .post('/reports/z-report', { signature })
      .then((res) => {
        setModal({ open: true, title: 'Z-Report Summary', kind: 'zReport', loading: false, error: null, data: res.data });
        setFeedback('Z-report generated.');
      })
      .catch(setModalError);
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
      <header className="bg-teal-900 text-white w-full p-4 shadow-md flex justify-between items-center px-8">
        <h1 className="text-2xl font-bold">Manager Dashboard</h1>
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-2">
            <img src={user.picture} alt="Profile" className="w-8 h-8 rounded-full" />
            <span className="text-teal-200">Welcome, {user.name}</span>
          </div>
          <button
            onClick={() => setUser(null)}
            className="hover:bg-teal-800 px-4 py-2 rounded font-bold bg-teal-700 shadow-sm border border-teal-500 transition"
          >
            Logout
          </button>
        </div>
      </header>

      <main className="p-8 w-full max-w-7xl">
        <div className="flex space-x-4 mb-6 border-b pb-4" role="tablist" aria-label="Manager sections">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'reports'}
            onClick={() => setActiveTab('reports')}
            className={`px-6 py-2 shadow-sm font-bold rounded border ${
              activeTab === 'reports'
                ? 'bg-teal-700 text-white border-teal-700'
                : 'text-teal-700 hover:bg-teal-50 bg-white border-teal-200'
            }`}
          >
            Reports
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'inventory'}
            onClick={() => setActiveTab('inventory')}
            className={`px-6 py-2 shadow-sm font-bold rounded border ${
              activeTab === 'inventory'
                ? 'bg-teal-700 text-white border-teal-700'
                : 'text-teal-700 hover:bg-teal-50 bg-white border-teal-200'
            }`}
          >
            Inventory
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'menu'}
            onClick={() => setActiveTab('menu')}
            className={`px-6 py-2 shadow-sm font-bold rounded border ${
              activeTab === 'menu'
                ? 'bg-teal-700 text-white border-teal-700'
                : 'text-teal-700 hover:bg-teal-50 bg-white border-teal-200'
            }`}
          >
            Menu Items
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
                          <td className="p-3 text-right tabular-nums text-amber-700">
                            {Number(row.restock_threshold).toFixed(2)}
                          </td>
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

          {activeTab === 'reports' && (
            <>
              <h2 className="text-2xl font-semibold mb-2 text-gray-800">Reports</h2>
              <p className="text-gray-500 mb-6">
                Product usage, X-report hourly sales, Z-report end-of-day summary, and sales-by-item.
              </p>

              <div className="flex space-x-2 mb-6 border-b pb-4" role="tablist" aria-label="Report types">
                <button
                  type="button"
                  role="tab"
                  aria-selected={reportTab === 'productUsage'}
                  onClick={() => setReportTab('productUsage')}
                  className={`px-4 py-2 shadow-sm font-bold rounded ${
                    reportTab === 'productUsage' ? 'bg-teal-700 text-white' : 'bg-white text-teal-700 hover:bg-teal-50 border border-teal-200'
                  }`}
                >
                  Product Usage
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={reportTab === 'xReport'}
                  onClick={() => setReportTab('xReport')}
                  className={`px-4 py-2 shadow-sm font-bold rounded ${
                    reportTab === 'xReport' ? 'bg-teal-700 text-white' : 'bg-white text-teal-700 hover:bg-teal-50 border border-teal-200'
                  }`}
                >
                  X-Report
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={reportTab === 'zReport'}
                  onClick={() => setReportTab('zReport')}
                  className={`px-4 py-2 shadow-sm font-bold rounded ${
                    reportTab === 'zReport' ? 'bg-teal-700 text-white' : 'bg-white text-teal-700 hover:bg-teal-50 border border-teal-200'
                  }`}
                >
                  Z-Report
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={reportTab === 'salesReport'}
                  onClick={() => setReportTab('salesReport')}
                  className={`px-4 py-2 shadow-sm font-bold rounded ${
                    reportTab === 'salesReport' ? 'bg-teal-700 text-white' : 'bg-white text-teal-700 hover:bg-teal-50 border border-teal-200'
                  }`}
                >
                  Sales Report
                </button>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl p-6">
                {feedback && (
                  <p className={`mb-4 font-medium ${feedback.includes('No') ? 'text-amber-700' : 'text-teal-800'}`}>
                    {feedback}
                  </p>
                )}

                {reportTab === 'productUsage' && (
                  <>
                    <h3 className="text-xl font-semibold mb-2 text-gray-800">Product Usage</h3>
                    <p className="text-gray-500 mb-4">
                      Inventory consumed by sold products over the selected date range.
                    </p>

                    <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">From</label>
                        <input
                          type="date"
                          value={rangeFrom}
                          onChange={(e) => setRangeFrom(e.target.value)}
                          className="rounded-lg border border-stone-200 px-3 py-2 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">To</label>
                        <input
                          type="date"
                          value={rangeTo}
                          onChange={(e) => setRangeTo(e.target.value)}
                          className="rounded-lg border border-stone-200 px-3 py-2 text-sm"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={openProductUsage}
                        className="mt-1 rounded-xl bg-teal-700 px-5 py-3 text-sm font-bold text-white shadow hover:bg-teal-600 transition"
                      >
                        Open Product Usage Graph
                      </button>
                    </div>
                  </>
                )}

                {reportTab === 'xReport' && (
                  <>
                    <h3 className="text-xl font-semibold mb-2 text-gray-800">X-Report (Hourly Sales)</h3>
                    <p className="text-gray-500 mb-5">
                      View today’s sales by hour in a bar chart. (Uses the current day in Project 3’s schema.)
                    </p>
                    <button
                      type="button"
                      onClick={openXReport}
                      className="rounded-xl bg-teal-700 px-5 py-3 text-sm font-bold text-white shadow hover:bg-teal-600 transition"
                    >
                      Open X-Report Chart
                    </button>
                  </>
                )}

                {reportTab === 'zReport' && (
                  <>
                    <h3 className="text-xl font-semibold mb-2 text-gray-800">Z-Report (End of Day)</h3>
                    <p className="text-gray-500 mb-5">
                      Close the business day and get a full summary. Enter your signature before running.
                    </p>

                    <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
                      <div className="w-full sm:w-[280px]">
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Signature</label>
                        <input
                          type="text"
                          value={signature}
                          onChange={(e) => setSignature(e.target.value)}
                          placeholder="Your name or initials"
                          className="rounded-lg border border-stone-200 px-3 py-2 text-sm w-full"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={runZReport}
                        className="mt-1 rounded-xl bg-teal-700 px-5 py-3 text-sm font-bold text-white shadow hover:bg-teal-600 transition"
                      >
                        Run Z-Report
                      </button>
                    </div>
                  </>
                )}

                {reportTab === 'salesReport' && (
                  <>
                    <h3 className="text-xl font-semibold mb-2 text-gray-800">Sales by Item</h3>
                    <p className="text-gray-500 mb-4">
                      View revenue and quantity sold per menu item for any date range.
                    </p>

                    <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">From</label>
                        <input
                          type="date"
                          value={rangeFrom}
                          onChange={(e) => setRangeFrom(e.target.value)}
                          className="rounded-lg border border-stone-200 px-3 py-2 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">To</label>
                        <input
                          type="date"
                          value={rangeTo}
                          onChange={(e) => setRangeTo(e.target.value)}
                          className="rounded-lg border border-stone-200 px-3 py-2 text-sm"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={openSalesByItem}
                        className="mt-1 rounded-xl bg-teal-700 px-5 py-3 text-sm font-bold text-white shadow hover:bg-teal-600 transition"
                      >
                        Open Sales Report
                      </button>
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </main>

      <Modal
        open={modal.open}
        title={modal.title}
        onClose={() => setModal((m) => ({ ...m, open: false, loading: false, error: null, data: null }))}
      >
        {modal.loading && <p className="text-gray-600">Loading…</p>}
        {!modal.loading && modal.error && <p className="text-red-600">{modal.error}</p>}
        {!modal.loading && !modal.error && modal.kind === 'productUsage' && (
          <>
            {(!modal.data?.points || modal.data.points.length === 0) ? (
              <p className="text-gray-600">No usage data found for the selected date range.</p>
            ) : (
              <div className="space-y-4">
                <p className="text-gray-700 font-medium">Units consumed from inventory (via `ProductInventory` + `TransactionItem`).</p>
                <LineChartCategory
                  data={(modal.data.points || []).map((p) => ({ label: p.itemName, value: p.usedQuantity }))}
                />
              </div>
            )}
          </>
        )}

        {!modal.loading && !modal.error && modal.kind === 'xReport' && (
          <>
            <div className="space-y-2 mb-4">
              <p className="text-gray-800 font-medium">{modal.data?.summary}</p>
              <p className="text-gray-600">{modal.data?.paymentMethodSummary}</p>
            </div>
            {(!modal.data?.hours || modal.data.hours.length === 0) ? (
              <p className="text-gray-600">No hourly sales data yet.</p>
            ) : (
              <VerticalBarChart
                data={(modal.data.hours || []).map((h) => ({ label: h.hourBucket, value: h.salesAmount }))}
                valueFormatter={formatCurrency}
              />
            )}
          </>
        )}

        {!modal.loading && !modal.error && modal.kind === 'salesReport' && (
          <>
            {(!modal.data?.items || modal.data.items.length === 0) ? (
              <p className="text-gray-600">No sales found for the selected range.</p>
            ) : (
              <div className="space-y-3">
                <p className="text-gray-800 font-medium">Revenue by item (sorted by revenue).</p>
                <HorizontalBarChart
                  data={(modal.data.items || []).map((it) => ({ label: it.itemName, value: it.revenue }))}
                  valueFormatter={formatCurrency}
                  height={320}
                />
              </div>
            )}
          </>
        )}

        {!modal.loading && !modal.error && modal.kind === 'zReport' && (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
              <div className="lg:col-span-2 space-y-4">
                <p className="text-gray-800 font-bold text-lg">End of day summary</p>
                <table className="w-full text-left border-collapse">
                  <tbody>
                    {[
                      ['Business day start', modal.data?.startAt],
                      ['Business day end', modal.data?.endAt],
                      ['Total sales', modal.data?.salesTotal != null ? formatCurrency(modal.data.salesTotal) : '—'],
                      ['Tax', modal.data?.taxAmount != null ? formatCurrency(modal.data.taxAmount) : '—'],
                      ['Sales count', modal.data?.salesCount != null ? String(modal.data.salesCount) : '—'],
                      ['Total cash', modal.data?.totalCash != null ? formatCurrency(modal.data.totalCash) : '—'],
                      ['Discounts', modal.data?.discounts != null ? formatCurrency(modal.data.discounts) : '$0.00'],
                      ['Voids', modal.data?.voids != null ? String(modal.data.voids) : '0'],
                      ['Service charges', modal.data?.serviceCharges != null ? formatCurrency(modal.data.serviceCharges) : '$0.00'],
                      ['Top item', modal.data?.topItem || 'N/A'],
                      ['Employee signature', modal.data?.employeeSignature || 'Manager'],
                    ].map(([metric, value]) => (
                      <tr key={metric} className="border-b border-stone-100">
                        <td className="py-2 pr-4 text-sm font-semibold text-gray-700">{metric}</td>
                        <td className="py-2 text-sm text-gray-900">{value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="space-y-3">
                <p className="text-gray-800 font-bold">Payment methods</p>
                <DonutChart
                  data={(modal.data?.paymentMethods || []).map((pm) => ({
                    name: pm.methodName,
                    value: pm.totalAmount,
                  }))}
                />
                <p className="text-sm text-gray-600">
                  (Payment breakdown isn’t stored in Project 3, so Z-report uses a single “Unspecified” slice.)
                </p>
              </div>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
