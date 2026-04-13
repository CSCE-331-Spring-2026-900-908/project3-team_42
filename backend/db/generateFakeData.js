const db = require('./config');

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickRandom(arr) {
  return arr[randomInt(0, arr.length - 1)];
}

function randomCustomization() {
  const ice = pickRandom(['0%', '25%', '50%', '100%']);
  const sugar = pickRandom(['0%', '30%', '50%', '70%', '100%']);
  const toppingsPool = ['boba', 'lychee jelly', 'pudding'];
  const toppings = [];
  const n = randomInt(0, 2);
  for (let i = 0; i < n; i++) {
    const t = pickRandom(toppingsPool);
    if (!toppings.includes(t)) toppings.push(t);
  }
  const obj = { ice, sugar };
  if (toppings.length) obj.toppings = toppings;
  return obj;
}

async function main() {
  const ORDER_COUNT = 10 + randomInt(0, 5);

  const menuRes = await db.query('SELECT id, default_price FROM menu_items WHERE is_available = TRUE');
  const cashierRes = await db.query("SELECT id FROM users WHERE role = 'cashier'");

  const menuItems = menuRes.rows;
  const cashiers = cashierRes.rows.map((r) => r.id);

  if (menuItems.length === 0 || cashiers.length === 0) {
    console.error('Need menu items and at least one cashier user. Run: node db/init.js');
    await db.end();
    process.exit(1);
  }

  for (let o = 0; o < ORDER_COUNT; o++) {
    const lineCount = randomInt(1, 4);
    const lines = [];
    let total = 0;

    for (let i = 0; i < lineCount; i++) {
      const mi = pickRandom(menuItems);
      const qty = randomInt(1, 3);
      const price = Number(mi.default_price);
      total += price * qty;
      lines.push({
        menu_item_id: mi.id,
        quantity: qty,
        customization: Math.random() > 0.2 ? randomCustomization() : null,
        price_at_time: price,
      });
    }

    const cashierId = pickRandom(cashiers);
    const status = pickRandom(['pending', 'completed', 'completed', 'completed']); // weighted toward completed

    await db.query('BEGIN');
    try {
      const orderRes = await db.query(
        'INSERT INTO orders (cashier_id, customer_account_id, total_amount, status) VALUES ($1, NULL, $2, $3) RETURNING id',
        [cashierId, Number(total.toFixed(2)), status]
      );
      const orderId = orderRes.rows[0].id;

      for (const line of lines) {
        await db.query(
          'INSERT INTO order_items (order_id, menu_item_id, quantity, customization, price_at_time) VALUES ($1, $2, $3, $4, $5)',
          [orderId, line.menu_item_id, line.quantity, line.customization, line.price_at_time]
        );
      }
      await db.query('COMMIT');
      console.log(`Inserted order #${orderId} (${lineCount} lines, $${total.toFixed(2)})`);
    } catch (e) {
      await db.query('ROLLBACK');
      throw e;
    }
  }

  console.log(`Done. Inserted ${ORDER_COUNT} random orders.`);
  await db.end();
  process.exit(0);
}

main().catch(async (err) => {
  console.error(err);
  try {
    await db.end();
  } catch (_) {
    /* ignore */
  }
  process.exit(1);
});
