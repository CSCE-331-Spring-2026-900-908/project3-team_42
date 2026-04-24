/**
 * Loyalty points ledger + balance updates for customer kiosk accounts.
 * Call these helpers inside an open transaction on one pg client.
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

async function assertCustomerAccount(client, customerAccountId) {
  const r = await client.query('SELECT id FROM customer_accounts WHERE id = $1', [customerAccountId]);
  return r.rows[0]?.id ?? null;
}

async function awardOrderPoints(client, customerAccountId, orderId, subtotal) {
  const { total, base, bonus } = computeOrderPoints(subtotal);
  if (total <= 0) {
    await client.query('UPDATE orders SET points_earned = 0 WHERE id = $1', [orderId]);
    return { points_earned: 0, breakdown: { base: 0, bonus: 0 } };
  }

  await client.query('UPDATE orders SET points_earned = $1 WHERE id = $2', [total, orderId]);
  await client.query(
    `INSERT INTO points_ledger (customer_account_id, activity_type, points_delta, order_id, metadata)
     VALUES ($1, 'order', $2, $3, $4::jsonb)`,
    [customerAccountId, total, orderId, JSON.stringify({ base, bonus, subtotal: Number(subtotal) })]
  );
  await client.query(
    'UPDATE customer_accounts SET points_balance = COALESCE(points_balance, 0) + $1 WHERE id = $2',
    [total, customerAccountId]
  );

  return { points_earned: total, breakdown: { base, bonus } };
}

async function awardDailyLogin(client, customerAccountId) {
  const day = new Date().toISOString().slice(0, 10);
  const ins = await client.query(
    `INSERT INTO login_points_daily (customer_account_id, award_date) VALUES ($1, $2::date)
     ON CONFLICT DO NOTHING RETURNING customer_account_id`,
    [customerAccountId, day]
  );
  if (ins.rowCount === 0) {
    return { awarded: false, points: 0, award_date_utc: day };
  }

  await client.query(
    `INSERT INTO points_ledger (customer_account_id, activity_type, points_delta, order_id, metadata)
     VALUES ($1, 'login', $2, NULL, $3::jsonb)`,
    [customerAccountId, DAILY_LOGIN_POINTS, JSON.stringify({ award_date_utc: day })]
  );
  await client.query(
    'UPDATE customer_accounts SET points_balance = COALESCE(points_balance, 0) + $1 WHERE id = $2',
    [DAILY_LOGIN_POINTS, customerAccountId]
  );

  return { awarded: true, points: DAILY_LOGIN_POINTS, award_date_utc: day };
}

async function reverseOrderPoints(client, orderId) {
  const r = await client.query('SELECT customer_account_id, points_earned FROM orders WHERE id = $1', [orderId]);
  const row = r.rows[0];
  if (!row?.customer_account_id) return;

  const earned = Number(row.points_earned || 0);
  if (earned <= 0) return;

  const delta = -earned;
  await client.query(
    `INSERT INTO points_ledger (customer_account_id, activity_type, points_delta, order_id, metadata)
     VALUES ($1, 'order_reversal', $2, $3, '{"reason":"cancel"}'::jsonb)`,
    [row.customer_account_id, delta, orderId]
  );
  await client.query(
    'UPDATE customer_accounts SET points_balance = COALESCE(points_balance, 0) + $1 WHERE id = $2',
    [delta, row.customer_account_id]
  );
  await client.query('UPDATE orders SET points_earned = 0 WHERE id = $1', [orderId]);
}

module.exports = {
  computeOrderPoints,
  assertCustomerAccount,
  awardOrderPoints,
  awardDailyLogin,
  reverseOrderPoints,
  POINTS_PER_DOLLAR,
  DAILY_LOGIN_POINTS,
};
/**
 * Loyalty points ledger + balance updates for customer kiosk accounts.
 * Call these helpers inside an open transaction on one pg client.
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

async function assertCustomerAccount(client, customerAccountId) {
  const r = await client.query('SELECT id FROM customer_accounts WHERE id = $1', [customerAccountId]);
  return r.rows[0]?.id ?? null;
}

async function awardOrderPoints(client, customerAccountId, orderId, subtotal) {
  const { total, base, bonus } = computeOrderPoints(subtotal);
  if (total <= 0) {
    await client.query('UPDATE orders SET points_earned = 0 WHERE id = $1', [orderId]);
    return { points_earned: 0, breakdown: { base: 0, bonus: 0 } };
  }

  await client.query('UPDATE orders SET points_earned = $1 WHERE id = $2', [total, orderId]);
  await client.query(
    `INSERT INTO points_ledger (customer_account_id, activity_type, points_delta, order_id, metadata)
     VALUES ($1, 'order', $2, $3, $4::jsonb)`,
    [customerAccountId, total, orderId, JSON.stringify({ base, bonus, subtotal: Number(subtotal) })]
  );
  await client.query(
    'UPDATE customer_accounts SET points_balance = COALESCE(points_balance, 0) + $1 WHERE id = $2',
    [total, customerAccountId]
  );

  return { points_earned: total, breakdown: { base, bonus } };
}

async function awardDailyLogin(client, customerAccountId) {
  const day = new Date().toISOString().slice(0, 10);
  const ins = await client.query(
    `INSERT INTO login_points_daily (customer_account_id, award_date) VALUES ($1, $2::date)
     ON CONFLICT DO NOTHING RETURNING customer_account_id`,
    [customerAccountId, day]
  );
  if (ins.rowCount === 0) {
    return { awarded: false, points: 0, award_date_utc: day };
  }

  await client.query(
    `INSERT INTO points_ledger (customer_account_id, activity_type, points_delta, order_id, metadata)
     VALUES ($1, 'login', $2, NULL, $3::jsonb)`,
    [customerAccountId, DAILY_LOGIN_POINTS, JSON.stringify({ award_date_utc: day })]
  );
  await client.query(
    'UPDATE customer_accounts SET points_balance = COALESCE(points_balance, 0) + $1 WHERE id = $2',
    [DAILY_LOGIN_POINTS, customerAccountId]
  );

  return { awarded: true, points: DAILY_LOGIN_POINTS, award_date_utc: day };
}

async function reverseOrderPoints(client, orderId) {
  const r = await client.query('SELECT customer_account_id, points_earned FROM orders WHERE id = $1', [orderId]);
  const row = r.rows[0];
  if (!row?.customer_account_id) return;

  const earned = Number(row.points_earned || 0);
  if (earned <= 0) return;

  const delta = -earned;
  await client.query(
    `INSERT INTO points_ledger (customer_account_id, activity_type, points_delta, order_id, metadata)
     VALUES ($1, 'order_reversal', $2, $3, '{"reason":"cancel"}'::jsonb)`,
    [row.customer_account_id, delta, orderId]
  );
  await client.query(
    'UPDATE customer_accounts SET points_balance = COALESCE(points_balance, 0) + $1 WHERE id = $2',
    [delta, row.customer_account_id]
  );
  await client.query('UPDATE orders SET points_earned = 0 WHERE id = $1', [orderId]);
}

module.exports = {
  computeOrderPoints,
  assertCustomerAccount,
  awardOrderPoints,
  awardDailyLogin,
  reverseOrderPoints,
  POINTS_PER_DOLLAR,
  DAILY_LOGIN_POINTS,
};
