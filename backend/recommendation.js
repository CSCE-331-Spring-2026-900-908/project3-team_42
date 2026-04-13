/**
 * "Recommendation of the day": RandomForestClassifier (ml-random-forest) on a small feature vector.
 * Features: temp, rain, month sin/cos, user category mix (milk / fruit / slush / other).
 * Weather is pinned per UTC day so the pick stays stable. Falls back to top-selling drink.
 */

const fs = require('fs');
const path = require('path');
const { RandomForestClassifier } = require('ml-random-forest');
const { Matrix } = require('ml-matrix');

const MODEL_PATH = path.join(__dirname, 'ml', 'rf_model.json');
const UA = '(bubbletea-pos, reveille.bubbletea@gmail.com)';

let classifier = null;
let menuIds = [];

/** One fetch per UTC date for stable recommendations. */
let weatherPin = { date: null, tempF: 72, rain: 0, forecast: '' };
const resultCache = new Map();

function loadModel() {
  if (classifier) return;
  const data = JSON.parse(fs.readFileSync(MODEL_PATH, 'utf8'));
  classifier = RandomForestClassifier.load(data.model);
  menuIds = (data.menuItemIds || []).map(Number);
}

function catSlot(category) {
  const c = String(category || '').toLowerCase();
  if (c.includes('milk')) return 0;
  if (c.includes('fruit')) return 1;
  if (c.includes('slush')) return 2;
  return 3;
}

async function userCategoryMix(db, userId) {
  const flat = [0.25, 0.25, 0.25, 0.25];
  if (!userId) return flat;
  const r = await db.query(
    `SELECT mi.category, SUM(oi.quantity)::float AS q
     FROM order_items oi
     JOIN orders o ON o.id = oi.order_id AND o.status = 'completed'
     JOIN menu_items mi ON mi.id = oi.menu_item_id
     WHERE o.customer_user_id = $1
     GROUP BY mi.category`,
    [userId]
  );
  const acc = [0, 0, 0, 0];
  for (const row of r.rows || []) {
    acc[catSlot(row.category)] += Number(row.q || 0);
  }
  const t = acc.reduce((a, b) => a + b, 0);
  if (t <= 0) return flat;
  return acc.map((x) => x / t);
}

async function pinWeather(utcDateStr) {
  if (weatherPin.date === utcDateStr) return weatherPin;
  try {
    const p1 = await fetch('https://api.weather.gov/points/30.6280,-96.3344', {
      headers: { 'User-Agent': UA },
    });
    const j1 = await p1.json();
    const p2 = await fetch(j1.properties.forecast, { headers: { 'User-Agent': UA } });
    const j2 = await p2.json();
    const p = j2.properties.periods[0];
    let tf = Number(p.temperature);
    if (p.temperatureUnit === 'C' && Number.isFinite(tf)) tf = (tf * 9) / 5 + 32;
    const rain = /rain|shower|drizzle|thunder|snow/i.test(String(p.shortForecast || '')) ? 1 : 0;
    weatherPin = {
      date: utcDateStr,
      tempF: Number.isFinite(tf) ? tf : 72,
      rain,
      forecast: p.shortForecast || '',
    };
  } catch {
    weatherPin = { date: utcDateStr, tempF: 72, rain: 0, forecast: '' };
  }
  return weatherPin;
}

function featureRow(w, mix, month) {
  const ang = (month / 12) * 2 * Math.PI;
  return [
    Math.min(1, w.tempF / 100),
    w.rain,
    Math.sin(ang),
    Math.cos(ang),
    mix[0],
    mix[1],
    mix[2],
    mix[3],
  ];
}

async function topSellingId(db) {
  const r = await db.query(
    `SELECT oi.menu_item_id AS id, SUM(oi.quantity)::float AS q
     FROM order_items oi
     JOIN orders o ON o.id = oi.order_id AND o.status = 'completed'
     GROUP BY oi.menu_item_id
     ORDER BY q DESC NULLS LAST
     LIMIT 1`
  );
  return r.rows[0]?.id ?? null;
}

async function firstMenu(db) {
  const r = await db.query(
    'SELECT id, name, description, category, default_price, image_url FROM menu_items WHERE is_available = TRUE ORDER BY id LIMIT 1'
  );
  return r.rows[0];
}

async function menuById(db, id) {
  const r = await db.query(
    'SELECT id, name, description, category, default_price, image_url FROM menu_items WHERE id = $1 AND is_available = TRUE',
    [id]
  );
  return r.rows[0];
}

function explain(w, mix, userId, source) {
  const hi = Math.max(...mix);
  const idx = mix.indexOf(hi);
  const label = ['milk tea', 'fruit tea', 'slush', 'other'][idx];
  if (source !== 'random_forest') return 'Popular pick from past sales.';
  if (userId && hi >= 0.38) return `Based on your past ${label} orders.`;
  if (w.tempF >= 80) return "Nice for a hot day (today’s weather).";
  if (w.rain) return 'A cozy choice for wet weather today.';
  return 'Combines today’s weather with what we know about your taste.';
}

async function dailyRecommendation(db, userId) {
  const utc = new Date().toISOString().slice(0, 10);
  const ck = `${utc}_${userId ?? 'guest'}`;
  if (resultCache.has(ck)) return resultCache.get(ck);

  loadModel();
  const w = await pinWeather(utc);
  const mix = await userCategoryMix(db, userId);
  const month = new Date().getUTCMonth() + 1;
  const X = featureRow(w, mix, month);

  let source = 'popular';
  let pick = null;
  try {
    const pred = classifier.predict(new Matrix([X]))[0];
    const id = Math.round(Number(pred));
    if (menuIds.includes(id)) {
      pick = id;
      source = 'random_forest';
    }
  } catch {
    /* fall through */
  }
  if (pick == null) pick = await topSellingId(db);
  let drink = pick != null ? await menuById(db, pick) : null;
  if (!drink) drink = await firstMenu(db);

  const out = {
    date_utc: utc,
    drink,
    source,
    why: explain(w, mix, userId, source),
    weather: { temp_f: w.tempF, short_forecast: w.forecast },
  };
  if (resultCache.size > 80) resultCache.clear();
  resultCache.set(ck, out);
  return out;
}

module.exports = { dailyRecommendation };
