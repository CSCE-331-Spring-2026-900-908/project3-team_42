/**
 * Train RandomForest for drink id (menu_item_id). Run from backend/: node trainRecModel.js
 * Uses order history from DB when available, else synthetic rows. Writes ml/rf_model.json
 */

const fs = require('fs');
const path = require('path');
const { RandomForestClassifier } = require('ml-random-forest');
const { Matrix } = require('ml-matrix');

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function synthRows(menuIds, n, seed) {
  const rand = rng(seed);
  const X = [];
  const y = [];
  for (let i = 0; i < n; i++) {
    X.push([
      rand(),
      rand() > 0.75 ? 1 : 0,
      Math.sin(rand() * Math.PI * 2),
      Math.cos(rand() * Math.PI * 2),
      rand(),
      rand(),
      rand(),
      rand(),
    ]);
    y.push(menuIds[Math.floor(rand() * menuIds.length)]);
  }
  return { X, y };
}

async function rowsFromDb(db, menuIds) {
  const r = await db.query(
    `SELECT oi.menu_item_id, o.created_at, o.customer_user_id
     FROM order_items oi
     JOIN orders o ON o.id = oi.order_id
     WHERE o.status = 'completed'
     ORDER BY o.created_at ASC
     LIMIT 400`
  );
  const X = [];
  const y = [];
  const rand = rng(99);
  for (const row of r.rows || []) {
    const d = new Date(row.created_at);
    const m = d.getUTCMonth() + 1;
    const ang = (m / 12) * 2 * Math.PI;
    const uid = row.customer_user_id;
    let mix = [0.25, 0.25, 0.25, 0.25];
    if (uid) {
      const h = await db.query(
        `SELECT mi.category, SUM(oi2.quantity)::float q
         FROM order_items oi2
         JOIN orders o2 ON o2.id = oi2.order_id AND o2.status = 'completed'
         JOIN menu_items mi ON mi.id = oi2.menu_item_id
         WHERE o2.customer_user_id = $1 AND o2.created_at < $2
         GROUP BY mi.category`,
        [uid, d]
      );
      const acc = [0, 0, 0, 0];
      for (const z of h.rows || []) {
        const c = String(z.category || '').toLowerCase();
        const slot = c.includes('milk') ? 0 : c.includes('fruit') ? 1 : c.includes('slush') ? 2 : 3;
        acc[slot] += Number(z.q || 0);
      }
      const t = acc.reduce((a, b) => a + b, 0);
      if (t > 0) mix = acc.map((x) => x / t);
    }
    const temp = 55 + rand() * 35;
    X.push([
      Math.min(1, temp / 100),
      rand() > 0.78 ? 1 : 0,
      Math.sin(ang),
      Math.cos(ang),
      mix[0],
      mix[1],
      mix[2],
      mix[3],
    ]);
    y.push(Number(row.menu_item_id));
  }
  return { X, y };
}

async function main() {
  const out = path.join(__dirname, 'ml', 'rf_model.json');
  fs.mkdirSync(path.dirname(out), { recursive: true });

  let menuIds = [1, 2, 3, 4, 5];
  let X = [];
  let y = [];

  if (process.env.SKIP_DB !== '1') {
    try {
      const db = require('./db/config');
      const m = await db.query('SELECT id FROM menu_items WHERE is_available = TRUE ORDER BY id');
      if (m.rows?.length) menuIds = m.rows.map((r) => Number(r.id));
      const fromDb = await rowsFromDb(db, menuIds);
      X = fromDb.X;
      y = fromDb.y;
      await db.end();
    } catch (e) {
      console.warn('DB train skipped:', e.message);
    }
  }

  if (X.length < 50) {
    const syn = synthRows(menuIds, 120 - X.length, 20260412);
    X = X.concat(syn.X);
    y = y.concat(syn.y);
  }

  const rf = new RandomForestClassifier({
    nEstimators: 40,
    maxFeatures: 0.75,
    seed: 7,
    treeOptions: { maxDepth: 10 },
    noOOB: true,
  });
  rf.train(new Matrix(X), y);
  fs.writeFileSync(
    out,
    JSON.stringify({
      menuItemIds: menuIds,
      trainedAt: new Date().toISOString(),
      model: rf.toJSON(),
    })
  );
  console.log('Wrote', out, 'rows', X.length);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
