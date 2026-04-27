import { useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CUSTOMER_ORDER_CONFIRMATION_STORAGE_KEY } from '../api';
import { clearActiveKioskCart } from '../lib/kioskCart';
import { BOBAS_PER_FREE_REWARD, buildRewardsSummary } from '../lib/rewards';

function formatMoney(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

export default function OrderConfirmation() {
  const navigate = useNavigate();
  const location = useLocation();

  const order = useMemo(() => {
    if (location.state?.order) {
      return location.state.order;
    }

    try {
      const saved = sessionStorage.getItem(CUSTOMER_ORDER_CONFIRMATION_STORAGE_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  }, [location.state]);

  useEffect(() => {
    if (order) return;
    navigate('/customer', { replace: true });
  }, [navigate, order]);

  const rewards = useMemo(
    () => buildRewardsSummary(order?.rewardsBalance ?? 0),
    [order?.rewardsBalance]
  );

  if (!order) {
    return null;
  }

  const filledRewardChips =
    rewards.progressCount === 0 && rewards.pointsBalance > 0
      ? BOBAS_PER_FREE_REWARD
      : rewards.progressCount;

  const handleStartNewOrder = () => {
    sessionStorage.removeItem(CUSTOMER_ORDER_CONFIRMATION_STORAGE_KEY);
    clearActiveKioskCart();
    navigate('/customer', { replace: true });
  };

  const grossSubtotal = Number(order.grossSubtotal ?? order.subtotal ?? 0);
  const rewardDiscountAmount = Number(order.rewardDiscountAmount || 0);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(196,181,253,0.35),_transparent_34%),linear-gradient(180deg,_#fff8f3_0%,_#fff_100%)] px-4 py-8 font-[family-name:var(--font-ui)] text-stone-800 sm:px-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <section className="relative overflow-hidden rounded-[28px] border border-white/70 bg-white/85 px-6 py-8 shadow-[0_24px_70px_rgba(91,33,182,0.12)] backdrop-blur sm:px-8">
          <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-emerald-400 via-teal-400 to-sky-400" />
          <div className="absolute -right-6 top-6 h-24 w-24 rounded-full bg-emerald-200/50 blur-2xl" />
          <div className="absolute right-20 top-20 h-14 w-14 rounded-full bg-amber-200/60 blur-xl" />

          <div className="relative flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <div className="confirmation-badge mb-5 inline-flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-4xl text-emerald-600 shadow-inner shadow-emerald-200">
                ✓
              </div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">Order confirmed</p>
              <h1 className="mt-3 text-4xl font-black tracking-tight text-stone-950 sm:text-5xl">
                Thanks, your boba is in the queue.
              </h1>
              <p className="mt-4 max-w-xl text-base leading-7 text-stone-600">
                We saved a full receipt for this order, including your drinks and rewards progress.
              </p>
            </div>

            <div className={`grid gap-4 lg:grid-cols-1 ${order.isGuest ? 'sm:grid-cols-2 lg:w-[360px]' : 'sm:grid-cols-3 lg:w-[440px]'}`}>
              <div className="rounded-3xl border border-stone-200 bg-stone-50 px-5 py-4">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-stone-400">Order number</p>
                <p className="mt-2 text-4xl font-black text-stone-900">{order.orderNumber || order.orderId}</p>
              </div>
              <div className="rounded-3xl border border-violet-200 bg-violet-50 px-5 py-4">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-500">Total paid</p>
                <p className="mt-2 text-3xl font-black text-violet-950">{formatMoney(order.total)}</p>
              </div>
              {!order.isGuest && (
                <div className="rounded-3xl border border-amber-200 bg-amber-50 px-5 py-4">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-600">Rewards points</p>
                  <p className="mt-2 text-3xl font-black text-amber-950">+{order.pointsEarned}</p>
                </div>
              )}
            </div>
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-[1.25fr_0.95fr]">
          <section className="rounded-[28px] border border-stone-200 bg-white px-6 py-6 shadow-sm sm:px-8">
            <div className="flex items-center justify-between gap-4 border-b border-stone-100 pb-4">
              <div>
                <h2 className="text-2xl font-black text-stone-950">Your order</h2>
                <p className="mt-1 text-sm text-stone-500">
                  {order.itemCount} item{order.itemCount === 1 ? '' : 's'} prepared just the way you asked.
                </p>
              </div>
              <span className="rounded-full bg-stone-100 px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-stone-500">
                Ready soon
              </span>
            </div>

            <div className="mt-5 space-y-4">
              {order.items.map((item) => (
                <article
                  key={item.id}
                  className="rounded-3xl border border-stone-100 bg-stone-50/80 px-4 py-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-bold text-stone-900">{item.name}</h3>
                      {item.customization && (
                        <p className="mt-1 text-sm text-stone-500">
                          Sweetness: {item.customization.sweetness}
                          {item.customization.size && ` | Size: ${item.customization.size}`}
                          {item.customization.hot && ' | Hot'}
                          {' | '}Ice: {item.customization.ice}
                          {item.customization.toppings?.length
                            ? ` | Toppings: ${item.customization.toppings.join(', ')}`
                            : ''}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-stone-500">Qty {item.quantity}</p>
                      <p className="mt-1 text-lg font-black text-stone-900">{formatMoney(item.lineTotal)}</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>

            <div className="mt-6 rounded-3xl border border-stone-100 bg-stone-50 px-5 py-5">
              <div className="flex justify-between text-sm font-medium text-stone-500">
                <span>Subtotal</span>
                <span>{formatMoney(grossSubtotal)}</span>
              </div>
              {rewardDiscountAmount > 0 ? (
                <div className="mt-2 flex justify-between text-sm font-bold text-emerald-700">
                  <span>Free boba reward</span>
                  <span>-{formatMoney(rewardDiscountAmount)}</span>
                </div>
              ) : null}
              <div className="mt-2 flex justify-between text-sm font-medium text-stone-500">
                <span>Tax</span>
                <span>{formatMoney(order.tax)}</span>
              </div>
              <div className="mt-4 flex justify-between border-t border-stone-200 pt-4 text-xl font-black text-stone-950">
                <span>Total</span>
                <span>{formatMoney(order.total)}</span>
              </div>
            </div>
          </section>

          <section className="rounded-[28px] border border-stone-200 bg-white px-6 py-6 shadow-sm sm:px-8">
            {order.isGuest ? (
              <div className="flex h-full flex-col">
                <div className="rounded-[26px] bg-[linear-gradient(135deg,_rgba(251,191,36,0.14),_rgba(196,181,253,0.18),_rgba(45,212,191,0.10))] px-6 py-7">
                  <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white/80 text-2xl shadow-sm">
                    🎁
                  </div>
                  <h2 className="mt-4 text-2xl font-black leading-tight text-stone-950">
                    Earn points on your next boba.
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-stone-600">
                    Enter your name and email at checkout next time to start earning {' '}
                    <span className="font-semibold text-stone-900">1 point per drink</span>. Every {BOBAS_PER_FREE_REWARD} points = 1 free boba.
                  </p>

                  <ul className="mt-5 space-y-2 text-sm text-stone-700">
                    <li className="flex items-start gap-2">
                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-500" />
                      Track free bobas right from the kiosk
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                      Keep your progress tied to your email
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-rose-400" />
                      No password needed for kiosk rewards
                    </li>
                  </ul>
                </div>

                <button
                  type="button"
                  onClick={handleStartNewOrder}
                  className="mt-6 w-full rounded-2xl bg-stone-900 py-4 text-lg font-bold text-white transition hover:bg-stone-800 active:scale-[0.99]"
                >
                  Start a new order
                </button>
                <p className="mt-3 text-center text-xs text-stone-400">
                  This order won't earn points, but your next one can.
                </p>
              </div>
            ) : (
            <>
            <div className="rounded-[26px] bg-[linear-gradient(135deg,_rgba(251,191,36,0.12),_rgba(45,212,191,0.12),_rgba(196,181,253,0.16))] px-5 py-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-700">Rewards progress</p>
                  <h2 className="mt-2 text-2xl font-black text-stone-950">
                    Buy {BOBAS_PER_FREE_REWARD}, earn 1 free
                  </h2>
                </div>
                <div className="reward-burst rounded-full border border-amber-300 bg-white/80 px-4 py-2 text-right shadow-sm">
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-amber-600">Free bobas</p>
                  <p className="text-2xl font-black text-amber-950">{rewards.freeBobaCount}</p>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-5 gap-3">
                {Array.from({ length: BOBAS_PER_FREE_REWARD }).map((_, index) => {
                  const filled = index < filledRewardChips;

                  return (
                    <div
                      key={index}
                      className={`flex aspect-square items-center justify-center rounded-2xl border text-2xl transition ${
                        filled
                          ? 'border-amber-300 bg-amber-100 text-amber-700 shadow-sm'
                          : 'border-white/80 bg-white/70 text-stone-300'
                      } ${filled ? 'reward-chip-filled' : ''}`}
                    >
                      🧋
                    </div>
                  );
                })}
              </div>

              <div className="mt-5 rounded-3xl border border-white/80 bg-white/70 px-4 py-4">
                <p className="text-lg font-bold text-stone-900">
                  {rewards.pointsToNextFreeBoba} more boba{rewards.pointsToNextFreeBoba === 1 ? '' : 's'} until your next free one.
                </p>
                <p className="mt-1 text-sm text-stone-600">
                  You now have {rewards.pointsBalance} total reward point{rewards.pointsBalance === 1 ? '' : 's'}.
                </p>
              </div>
            </div>

            <div className="mt-6 rounded-3xl border border-emerald-200 bg-emerald-50 px-5 py-5">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">
                {order.justRedeemedFreeBoba ? 'Reward redeemed' : 'This order earned'}
              </p>
              <div className="mt-3 flex items-end gap-3">
                <p className="text-5xl font-black text-emerald-950">
                  {order.justRedeemedFreeBoba ? formatMoney(rewardDiscountAmount) : `+${order.pointsEarned}`}
                </p>
                <p className="pb-2 text-sm font-semibold text-emerald-800">
                  {order.justRedeemedFreeBoba
                    ? `${order.redeemedFreeBobaCount || 1} free boba applied`
                    : `reward point${order.pointsEarned === 1 ? '' : 's'}`}
                </p>
              </div>
              {order.justRedeemedFreeBoba ? (
                <p className="mt-3 text-sm font-semibold text-emerald-800">
                  We used {order.redeemedRewardPoints || BOBAS_PER_FREE_REWARD} reward points so you did not pay for this boba.
                  {order.pointsEarned > 0 ? ` Paid drinks still earned +${order.pointsEarned} point${order.pointsEarned === 1 ? '' : 's'}.` : ''}
                </p>
              ) : null}
              {order.justUnlockedFreeBoba ? (
                <p className="mt-3 text-sm font-semibold text-emerald-800">
                  Nice. This order unlocked a new free boba.
                </p>
              ) : null}
            </div>

            <button
              type="button"
              onClick={handleStartNewOrder}
              className="mt-6 w-full rounded-2xl bg-stone-900 py-4 text-lg font-bold text-white transition hover:bg-stone-800 active:scale-[0.99]"
            >
              Start new order
            </button>
            </>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
