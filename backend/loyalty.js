/**
 * Loyalty points: ledger + balance updates (use inside an open transaction on one pg client).
 * Order vs login are distinguished by points_ledger.activity_type.
 */

const POINTS_PER_DOLLAR = 10;
const LARGE_ORDER_USD = 20;
const LARGE_BONUS = 25;
const DAILY_LOGIN_POINTS = 5;

function computeOrderPoints(subtotal) {
  const s = Number(subtotal);
  if (!Number.isFinite(s) || s < 0) return { total: 0, base: 0, bonus: 0 };
  const base = Math.floor(s * POINTS_PER_DOLLAR);
  const bonus = s >= LARGE_ORDER_USD ? LARGE_BONUS : 0;
  return { total: base + bonus, base, bonus };
}

async function assertCustomer(client, userId) {
  const r = await client.query("SELECT id FROM users WHERE id = $1 AND role = 'customer'", [userId]);
  return r.rows[0]?.id ?? null;
}

async function awardOrderPoints(client, userId, orderId, subtotal) {
  const { total, base, bonus } = computeOrderPoints(subtotal);
  if (total <= 0) {
    await client.query('UPDATE orders SET points_earned = 0 WHERE id = $1', [orderId]);
    return { points_earned: 0, breakdown: { base: 0, bonus: 0 } };
  }
  await client.query('UPDATE orders SET points_earned = $1 WHERE id = $2', [total, orderId]);
  await client.query(
    `INSERT INTO points_ledger (user_id, activity_type, points_delta, order_id, metadata)
     VALUES ($1, 'order', $2, $3, $4::jsonb)`,
    [userId, total, orderId, JSON.stringify({ base, bonus, subtotal: Number(subtotal) })]
  );
  await client.query('UPDATE users SET points_balance = COALESCE(points_balance, 0) + $1 WHERE id = $2', [
    total,
    userId,
  ]);
  return { points_earned: total, breakdown: { base, bonus } };
}

/** At most once per UTC calendar day (login_points_daily). */
async function awardDailyLogin(client, userId) {
  const day = new Date().toISOString().slice(0, 10);
  const ins = await client.query(
    `INSERT INTO login_points_daily (user_id, award_date) VALUES ($1, $2::date)
     ON CONFLICT DO NOTHING RETURNING user_id`,
    [userId, day]
  );
  if (ins.rowCount === 0) {
    return { awarded: false, points: 0, award_date_utc: day };
  }
  await client.query(
    `INSERT INTO points_ledger (user_id, activity_type, points_delta, order_id, metadata)
     VALUES ($1, 'login', $2, NULL, $3::jsonb)`,
    [userId, DAILY_LOGIN_POINTS, JSON.stringify({ award_date_utc: day })]
  );
  await client.query('UPDATE users SET points_balance = COALESCE(points_balance, 0) + $1 WHERE id = $2', [
    DAILY_LOGIN_POINTS,
    userId,
  ]);
  return { awarded: true, points: DAILY_LOGIN_POINTS, award_date_utc: day };
}

async function reverseOrderPoints(client, orderId) {
  const r = await client.query(
    'SELECT customer_user_id, points_earned FROM orders WHERE id = $1',
    [orderId]
  );
  const row = r.rows[0];
  if (!row?.customer_user_id) return;
  const earned = Number(row.points_earned || 0);
  if (earned <= 0) return;
  const delta = -earned;
  await client.query(
    `INSERT INTO points_ledger (user_id, activity_type, points_delta, order_id, metadata)
     VALUES ($1, 'order_reversal', $2, $3, '{"reason":"cancel"}'::jsonb)`,
    [row.customer_user_id, delta, orderId]
  );
  await client.query('UPDATE users SET points_balance = COALESCE(points_balance, 0) + $1 WHERE id = $2', [
    delta,
    row.customer_user_id,
  ]);
  await client.query('UPDATE orders SET points_earned = 0 WHERE id = $1', [orderId]);
}

module.exports = {
  computeOrderPoints,
  assertCustomer,
  awardOrderPoints,
  awardDailyLogin,
  reverseOrderPoints,
  POINTS_PER_DOLLAR,
  DAILY_LOGIN_POINTS,
};
