import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api, { CUSTOMER_ORDER_CONFIRMATION_STORAGE_KEY } from '../api';

const KIOSK_CASHIER_ID = 3;

function getBasePrice(item) {
  return Number(item?.effective_price ?? item?.default_price ?? 0);
}

export default function CheckoutPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const { cart, cartTotal } = location.state || {};

  useEffect(() => {
    if (!cart || cart.length === 0) navigate('/customer', { replace: true });
  }, [cart, navigate]);

  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [isGuest, setIsGuest] = useState(false);
  const [loading, setLoading] = useState(false);
  const [payModalOpen, setPayModalOpen] = useState(false);

  if (!cart || cart.length === 0) return null;

  const subtotal = cartTotal;
  const tax = subtotal * 0.0825;
  const total = subtotal + tax;
  const itemCount = cart.reduce((n, l) => n + l.quantity, 0);

  const handleContinueAsGuest = () => {
    setIsGuest(true);
    setCustomerName('');
    setCustomerEmail('');
    setPayModalOpen(true);
  };

  const handleRewardsSubmit = (e) => {
    e.preventDefault();
    setIsGuest(false);
    setPayModalOpen(true);
  };

  const processPayment = async () => {
    setLoading(true);

    const orderSnapshot = cart.map((i) => ({
      id: i.unique_id ?? i.id,
      name: i.name,
      quantity: i.quantity,
      customization: i.customization || null,
      unitPrice: Number(i.custom_price ?? getBasePrice(i)),
      lineTotal: Number(i.custom_price ?? getBasePrice(i)) * i.quantity,
    }));

    const formattedItems = cart.map((i) => ({
      menu_item_id: i.id,
      quantity: i.quantity,
      customization: i.customization || null,
      price: i.custom_price ?? getBasePrice(i),
    }));

    try {
      const payload = {
        cashier_id: KIOSK_CASHIER_ID,
        total_amount: total,
        items: formattedItems,
        placed_via: 'customer_kiosk',
      };
      if (!isGuest && customerName.trim()) payload.customer_name = customerName.trim();
      if (!isGuest && customerEmail.trim()) payload.customer_email = customerEmail.trim();

      const res = await api.post('/orders', payload);

      const confirmationOrder = {
        orderId: res.data.id,
        orderNumber: res.data.orderNumber,
        items: orderSnapshot,
        itemCount,
        subtotal,
        tax,
        total,
        pointsEarned: res.data.pointsEarned || 0,
        rewardsBalance: res.data.rewardsBalance,
        freeBobaCount: res.data.freeBobaCount ?? 0,
        pointsToNextFreeBoba: res.data.pointsToNextFreeBoba ?? 5,
        isGuest,
      };

      sessionStorage.setItem(
        CUSTOMER_ORDER_CONFIRMATION_STORAGE_KEY,
        JSON.stringify(confirmationOrder)
      );

      navigate('/customer/confirmation', { state: { order: confirmationOrder } });
    } catch (err) {
      console.error(err);
      alert('Checkout failed. Please try again.');
      setLoading(false);
      setPayModalOpen(false);
    }
  };

  const hasRewardsInfo = customerName.trim() || customerEmail.trim();

  return (
    <div className="flex h-screen flex-row bg-[#faf9f7] font-sans overflow-hidden text-stone-800">

      {/* Left — Order Summary */}
      <div className="flex flex-1 flex-col px-8 pt-7 pb-0">
        <header className="mb-6 flex items-center gap-4">
          <button
            onClick={() => navigate('/customer')}
            className="flex items-center justify-center p-2 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-700 transition"
            aria-label="Back to menu"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <div>
            <h1 className="text-3xl font-extrabold text-stone-900 tracking-tight">Checkout</h1>
            <p className="text-sm text-stone-500 mt-0.5">{itemCount} {itemCount === 1 ? 'item' : 'items'}</p>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto space-y-3 pb-6">
          {cart.map((item) => (
            <div key={item.unique_id} className="flex items-start justify-between rounded-2xl border border-stone-200 bg-white p-4">
              <div className="flex-1 pr-4">
                <p className="font-bold text-stone-800">{item.name}</p>
                {item.customization && (
                  <p className="text-xs text-stone-400 mt-1">
                    {item.customization.sweetness} sweetness · {item.customization.ice} ice
                    {item.customization.toppings?.length > 0 && ` · ${item.customization.toppings.join(', ')}`}
                  </p>
                )}
                <p className="text-sm font-semibold text-stone-500 mt-1">Qty: {item.quantity}</p>
              </div>
              <span className="font-bold text-stone-800 tabular-nums">
                ${((item.custom_price ?? getBasePrice(item)) * item.quantity).toFixed(2)}
              </span>
            </div>
          ))}
        </div>

        <div className="border-t border-stone-200 py-5 shrink-0 space-y-2">
          <div className="flex justify-between text-sm font-medium text-stone-500">
            <span>Subtotal</span>
            <span>${subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm font-medium text-stone-500">
            <span>Tax (8.25%)</span>
            <span>${tax.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-2xl font-black text-stone-900 pt-2 border-t border-stone-200">
            <span>Total</span>
            <span>${total.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Right — Identity / Rewards */}
      <aside className="w-[400px] shrink-0 flex flex-col border-l border-stone-200 bg-white px-8 py-8">
        <div className="mb-6">
          <h2 className="text-2xl font-extrabold text-stone-900">Earn Rewards</h2>
          <p className="text-sm text-stone-500 mt-1">Add your name and email to collect points on every order.</p>
        </div>

        <form onSubmit={handleRewardsSubmit} className="flex flex-col gap-4 flex-1">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="customer-name" className="text-xs font-bold uppercase tracking-wider text-stone-500">
              Name
            </label>
            <input
              id="customer-name"
              type="text"
              value={customerName}
              onChange={(e) => { setCustomerName(e.target.value); setIsGuest(false); }}
              placeholder="Your first name"
              autoComplete="given-name"
              className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm font-medium text-stone-800 outline-none focus:border-stone-400 focus:ring-2 focus:ring-stone-200 transition"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="customer-email" className="text-xs font-bold uppercase tracking-wider text-stone-500">
              Gmail / Email
            </label>
            <input
              id="customer-email"
              type="email"
              value={customerEmail}
              onChange={(e) => { setCustomerEmail(e.target.value); setIsGuest(false); }}
              placeholder="you@gmail.com"
              autoComplete="email"
              className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm font-medium text-stone-800 outline-none focus:border-stone-400 focus:ring-2 focus:ring-stone-200 transition"
            />
          </div>

          <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-xs text-amber-800 font-medium">
            Earn 1 point per drink. Get a free boba at 5 points!
          </div>

          <button
            type="submit"
            disabled={!hasRewardsInfo || isGuest}
            className="w-full rounded-2xl bg-stone-800 py-4 text-base font-bold text-white transition hover:bg-stone-700 active:scale-[0.98] disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Pay &amp; Earn Points — ${total.toFixed(2)}
          </button>
        </form>

        <div className="mt-5 flex items-center gap-3">
          <div className="h-px flex-1 bg-stone-100" />
          <span className="text-xs font-semibold text-stone-400">or</span>
          <div className="h-px flex-1 bg-stone-100" />
        </div>

        <button
          type="button"
          onClick={handleContinueAsGuest}
          className="mt-5 w-full rounded-2xl border border-stone-200 bg-white py-4 text-base font-bold text-stone-700 transition hover:bg-stone-50 active:scale-[0.98]"
        >
          Continue as Guest
        </button>
        <p className="mt-2 text-center text-xs text-stone-400">No account needed — you can still place your order.</p>
      </aside>

      {/* Tap-to-pay modal */}
      {payModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl bg-white p-8 shadow-2xl flex flex-col items-center text-center">
            <h2 className="text-2xl font-black text-slate-900 mb-1">Tap to Pay</h2>
            <p className="text-slate-500 mb-1 font-medium">Total: ${total.toFixed(2)}</p>
            {!isGuest && (customerName || customerEmail) && (
              <p className="text-xs text-violet-600 font-semibold mb-4">
                Rewards for {customerName || customerEmail}
              </p>
            )}
            {isGuest && (
              <p className="text-xs text-stone-400 mb-4">Guest checkout</p>
            )}

            <button
              onClick={processPayment}
              disabled={loading}
              className="group relative flex h-48 w-48 flex-col items-center justify-center gap-4 rounded-[2rem] bg-slate-50 border-2 border-dashed border-slate-300 transition-all hover:border-violet-400 hover:bg-violet-50 active:scale-95 disabled:pointer-events-none disabled:opacity-70"
            >
              <div className="text-6xl transition-transform group-hover:scale-110">💳</div>
              <span className="font-bold text-slate-600 group-hover:text-violet-600">
                {loading ? 'Processing...' : 'Tap Simulator'}
              </span>
            </button>

            <button
              onClick={() => { if (!loading) setPayModalOpen(false); }}
              disabled={loading}
              className="mt-6 text-sm font-bold text-slate-400 hover:text-slate-600 transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
