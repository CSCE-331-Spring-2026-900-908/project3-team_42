import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api, { CUSTOMER_ORDER_CONFIRMATION_STORAGE_KEY } from '../api';
import KioskKeyboard from '../components/KioskKeyboard';
import { clearActiveKioskCart, loadActiveKioskCart } from '../lib/kioskCart';

const KIOSK_CASHIER_ID = 4;

function getBasePrice(item) {
  return Number(item?.effective_price ?? item?.default_price ?? 0);
}

export default function CheckoutPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const routeCart = location.state?.cart;
  const [storedCart] = useState(() => loadActiveKioskCart());
  const cart = Array.isArray(routeCart) && routeCart.length > 0 ? routeCart : storedCart;
  const routeCartTotal = Number(location.state?.cartTotal);
  const cartTotal =
    Array.isArray(routeCart) && routeCart.length > 0 && Number.isFinite(routeCartTotal)
      ? routeCartTotal
      : cart.reduce((sum, line) => sum + (line.custom_price ?? getBasePrice(line)) * line.quantity, 0);

  useEffect(() => {
    if (!cart || cart.length === 0) navigate('/customer', { replace: true });
  }, [cart, navigate]);

  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [isGuest, setIsGuest] = useState(false);
  const [loading, setLoading] = useState(false);
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [activeTextField, setActiveTextField] = useState('email');
  const [keyboardVisible, setKeyboardVisible] = useState(true);

  if (!cart || cart.length === 0) return null;

  const subtotal = cartTotal;
  const tax = subtotal * 0.0825;
  const total = subtotal + tax;
  const itemCount = cart.reduce((n, l) => n + l.quantity, 0);
  const hasRewardsInfo = Boolean(customerName.trim() && customerEmail.trim());
  const activeFieldLabel = activeTextField === 'name' ? 'name' : 'email';

  const handleContinueAsGuest = () => {
    setIsGuest(true);
    setCustomerName('');
    setCustomerEmail('');
    setKeyboardVisible(false);
    setPayModalOpen(true);
  };

  const handleRewardsSubmit = (e) => {
    e.preventDefault();
    if (!hasRewardsInfo) return;
    setIsGuest(false);
    setKeyboardVisible(false);
    setPayModalOpen(true);
  };

  const updateActiveField = (updater) => {
    if (activeTextField === 'name') {
      setCustomerName((value) => updater(value));
      return;
    }

    setCustomerEmail((value) => updater(value));
  };

  const handleVirtualKeyPress = (key) => {
    setIsGuest(false);
    updateActiveField((value) => {
      if (key === 'backspace') return value.slice(0, -1);
      if (key === 'clear') return '';
      if (key === 'space') return activeTextField === 'email' ? value : `${value} `;
      return `${value}${key}`;
    });
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
      const paidSubtotal = Number(res.data.total_amount ?? subtotal);
      const rewardDiscountAmount = Number(res.data.rewardDiscountAmount || 0);
      const paidTax = paidSubtotal * 0.0825;
      const paidTotal = paidSubtotal + paidTax;

      const confirmationOrder = {
        orderId: res.data.id,
        orderNumber: res.data.orderNumber,
        items: orderSnapshot,
        itemCount,
        grossSubtotal: Number(res.data.gross_amount ?? subtotal),
        subtotal: paidSubtotal,
        tax: paidTax,
        total: paidTotal,
        rewardDiscountAmount,
        redeemedRewardPoints: res.data.redeemedRewardPoints ?? 0,
        redeemedFreeBobaCount: res.data.redeemedFreeBobaCount ?? 0,
        pointsEarned: res.data.pointsEarned || 0,
        rewardsBalance: res.data.rewardsBalance,
        freeBobaCount: res.data.freeBobaCount ?? 0,
        pointsToNextFreeBoba: res.data.pointsToNextFreeBoba ?? 5,
        justRedeemedFreeBoba: rewardDiscountAmount > 0,
        isGuest,
      };

      sessionStorage.setItem(
        CUSTOMER_ORDER_CONFIRMATION_STORAGE_KEY,
        JSON.stringify(confirmationOrder)
      );
      clearActiveKioskCart();

      navigate('/customer/confirmation', { state: { order: confirmationOrder } });
    } catch (err) {
      console.error(err);
      alert('Checkout failed. Please try again.');
      setLoading(false);
      setPayModalOpen(false);
    }
  };

  return (
    <div
      className={`flex h-screen flex-row overflow-hidden bg-[#faf9f7] font-sans text-stone-800 transition-[padding] duration-300 ${keyboardVisible ? 'pb-72' : ''}`}
    >
      {/* Left - Order Summary */}
      <div className="flex flex-1 flex-col px-8 pt-7 pb-0">
        <header className="mb-6 flex items-center gap-4">
          <button
            onClick={() => navigate('/customer', { replace: true })}
            className="rounded-full bg-stone-100 p-2 text-stone-700 transition hover:bg-stone-200"
            aria-label="Back to menu"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-stone-900">Checkout</h1>
            <p className="mt-0.5 text-sm text-stone-500">
              {itemCount} {itemCount === 1 ? 'item' : 'items'}
            </p>
          </div>
        </header>

        <div className="flex-1 space-y-3 overflow-y-auto pb-6">
          {cart.map((item) => (
            <div key={item.unique_id} className="flex items-start justify-between rounded-2xl border border-stone-200 bg-white p-4">
              <div className="flex-1 pr-4">
                <p className="font-bold text-stone-800">{item.name}</p>
                {item.customization && (
                  <p className="mt-1 text-xs text-stone-400">
                    {item.customization.sweetness} sweetness | {item.customization.ice} ice
                    {item.customization.toppings?.length > 0 && ` | ${item.customization.toppings.join(', ')}`}
                  </p>
                )}
                <p className="mt-1 text-sm font-semibold text-stone-500">Qty: {item.quantity}</p>
              </div>
              <span className="tabular-nums font-bold text-stone-800">
                ${((item.custom_price ?? getBasePrice(item)) * item.quantity).toFixed(2)}
              </span>
            </div>
          ))}
        </div>

        <div className="shrink-0 space-y-2 border-t border-stone-200 py-5">
          <div className="flex justify-between text-sm font-medium text-stone-500">
            <span>Subtotal</span>
            <span>${subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm font-medium text-stone-500">
            <span>Tax (8.25%)</span>
            <span>${tax.toFixed(2)}</span>
          </div>
          <div className="flex justify-between border-t border-stone-200 pt-2 text-2xl font-black text-stone-900">
            <span>Total</span>
            <span>${total.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Right - Identity / Rewards */}
      <aside className="flex w-[400px] shrink-0 flex-col border-l border-stone-200 bg-white px-8 py-8">
        <div className="mb-6">
          <h2 className="text-2xl font-extrabold text-stone-900">Earn Rewards</h2>
          <p className="mt-1 text-sm text-stone-500">Add your name and email to collect points on every order.</p>
        </div>

        <form onSubmit={handleRewardsSubmit} className="flex flex-1 flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="customer-name" className="text-xs font-bold uppercase tracking-wider text-stone-500">
              Name
            </label>
            <input
              id="customer-name"
              type="text"
              value={customerName}
              onFocus={() => {
                setActiveTextField('name');
                setKeyboardVisible(true);
              }}
              onChange={(e) => {
                setCustomerName(e.target.value);
                setIsGuest(false);
              }}
              placeholder="Your first name"
              autoComplete="given-name"
              className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm font-medium text-stone-800 outline-none transition focus:border-stone-400 focus:ring-2 focus:ring-stone-200"
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
              onFocus={() => {
                setActiveTextField('email');
                setKeyboardVisible(true);
              }}
              onChange={(e) => {
                setCustomerEmail(e.target.value);
                setIsGuest(false);
              }}
              placeholder="you@gmail.com"
              autoComplete="email"
              className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm font-medium text-stone-800 outline-none transition focus:border-stone-400 focus:ring-2 focus:ring-stone-200"
            />
          </div>

          <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-xs font-medium text-amber-800">
            Earn 1 point per drink. Name and email are required so we can track your rewards.
          </div>

          <button
            type="submit"
            disabled={!hasRewardsInfo || isGuest}
            className="w-full rounded-2xl bg-stone-800 py-4 text-base font-bold text-white transition hover:bg-stone-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-30"
          >
            Checkout &amp; Earn Points - ${total.toFixed(2)}
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
        <p className="mt-2 text-center text-xs text-stone-400">No account needed - you can still place your order.</p>
      </aside>

      {/* Tap-to-pay modal */}
      {payModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
          <div className="flex w-full max-w-sm flex-col items-center rounded-3xl bg-white p-8 text-center shadow-2xl">
            <h2 className="mb-1 text-2xl font-black text-slate-900">Tap to Pay</h2>
            <p className="mb-1 font-medium text-slate-500">Total: ${total.toFixed(2)}</p>
            {!isGuest && (customerName || customerEmail) && (
              <p className="mb-4 text-xs font-semibold text-violet-600">
                Rewards for {customerName || customerEmail}
              </p>
            )}
            {isGuest && <p className="mb-4 text-xs text-stone-400">Guest checkout</p>}

            <button
              onClick={processPayment}
              disabled={loading}
              className="group relative flex h-48 w-48 flex-col items-center justify-center gap-4 rounded-[2rem] border-2 border-dashed border-slate-300 bg-slate-50 transition-all hover:border-violet-400 hover:bg-violet-50 active:scale-95 disabled:pointer-events-none disabled:opacity-70"
            >
              <div className="text-6xl transition-transform group-hover:scale-110">{'\u{1F4B3}'}</div>
              <span className="font-bold text-slate-600 group-hover:text-violet-600">
                {loading ? 'Processing...' : 'Tap Simulator'}
              </span>
            </button>

            <button
              onClick={() => {
                if (!loading) setPayModalOpen(false);
              }}
              disabled={loading}
              className="mt-6 text-sm font-bold text-slate-400 transition hover:text-slate-600"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <KioskKeyboard
        visible={keyboardVisible && !payModalOpen}
        activeFieldLabel={activeFieldLabel}
        onKeyPress={handleVirtualKeyPress}
        onDone={() => setKeyboardVisible(false)}
      />
    </div>
  );
}
