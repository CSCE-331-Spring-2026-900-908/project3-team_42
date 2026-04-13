const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, 'seed-data');

function ensureDir() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

function escapeCsv(value) {
  if (value === null || value === undefined) return '';
  const s = String(value);
  if (s.includes('"') || s.includes(',') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function writeCsv(fileName, columns, rows) {
  const lines = [columns.join(',')];
  for (const row of rows) {
    lines.push(columns.map((c) => escapeCsv(row[c])).join(','));
  }
  fs.writeFileSync(path.join(OUT_DIR, fileName), `${lines.join('\n')}\n`, 'utf8');
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick(arr) {
  return arr[randomInt(0, arr.length - 1)];
}

function randomCustomizationJson() {
  const ice = pick(['0%', '25%', '50%', '100%']);
  const sugar = pick(['0%', '30%', '50%', '70%', '100%']);
  const toppingsPool = ['boba', 'lychee jelly', 'pudding'];
  const toppings = [];
  const n = randomInt(0, 2);
  for (let i = 0; i < n; i++) {
    const t = pick(toppingsPool);
    if (!toppings.includes(t)) toppings.push(t);
  }
  const obj = { ice, sugar };
  if (toppings.length) obj.toppings = toppings;
  return JSON.stringify(obj);
}

function isoDateHoursAgo(hoursAgo) {
  const d = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);
  return d.toISOString().replace('T', ' ').slice(0, 19);
}

function buildUsers() {
  return [
    { id: 1, name: 'Manager Reveille', role: 'manager', email: 'reveille.bubbletea@gmail.com' },
    { id: 2, name: 'Cashier Alice', role: 'cashier', email: 'alice@boba.com' },
    { id: 3, name: 'Cashier Bob', role: 'cashier', email: 'bob@boba.com' },
    { id: 4, name: 'Self-Service Kiosk', role: 'cashier', email: 'kiosk@reveilleboba.local' },
  ];
}

function buildInventory() {
  return [
    { id: 1, name: 'Tapioca Pearls (Boba)', category: 'Topping', quantity: 500, unit: 'oz', restock_threshold: 100 },
    { id: 2, name: 'Black Tea Leaves', category: 'Tea Base', quantity: 200, unit: 'oz', restock_threshold: 50 },
    { id: 3, name: 'Green Tea Leaves', category: 'Tea Base', quantity: 180, unit: 'oz', restock_threshold: 50 },
    { id: 4, name: 'Milk Powder', category: 'Dairy', quantity: 300, unit: 'oz', restock_threshold: 100 },
    { id: 5, name: 'Lychee Jelly', category: 'Topping', quantity: 200, unit: 'oz', restock_threshold: 50 },
    { id: 6, name: 'Mango Syrup', category: 'Syrup', quantity: 120, unit: 'pump', restock_threshold: 20 },
    { id: 7, name: 'Taro Powder', category: 'Powder', quantity: 150, unit: 'oz', restock_threshold: 40 },
    { id: 8, name: 'Brown Sugar Syrup', category: 'Syrup', quantity: 110, unit: 'pump', restock_threshold: 20 },
    { id: 9, name: 'Strawberry Syrup', category: 'Syrup', quantity: 100, unit: 'pump', restock_threshold: 20 },
    { id: 10, name: 'Jasmine Tea Leaves', category: 'Tea Base', quantity: 120, unit: 'oz', restock_threshold: 30 },
    { id: 11, name: 'Cups (Regular)', category: 'Packaging', quantity: 1000, unit: 'count', restock_threshold: 200 },
    { id: 12, name: 'Straws (Large)', category: 'Packaging', quantity: 2000, unit: 'count', restock_threshold: 300 },
  ];
}

function buildMenuItems() {
  const SHARETEA_MENU = [
    // Milky Series & Fresh Brew
    { name: 'Classic Pearl Milk Tea', category: 'Milk Tea', default_price: 4.75 },
    { name: 'Honey Pearl Milk Tea', category: 'Milk Tea', default_price: 5.00 },
    { name: 'Coffee Creama', category: 'Milk Tea', default_price: 5.50 },
    { name: 'Coffee Milk Tea w/ Coffee Jelly', category: 'Milk Tea', default_price: 5.25 },
    { name: 'Hokkaido Pearl Milk Tea', category: 'Milk Tea', default_price: 5.25 },
    { name: 'Thai Pearl Milk Tea', category: 'Milk Tea', default_price: 5.00 },
    { name: 'Taro Pearl Milk Tea', category: 'Milk Tea', default_price: 5.00 },
    { name: 'Mango Green Milk Tea', category: 'Milk Tea', default_price: 5.25 },
    { name: 'Golden Retriever', category: 'Milk Tea', default_price: 5.75 },
    { name: 'Coconut Pearl Milk Tea', category: 'Milk Tea', default_price: 5.50 },
    { name: 'Classic Tea', category: 'Specialty', default_price: 4.00 },
    { name: 'Honey Tea', category: 'Specialty', default_price: 4.50 },
  
    // Fruity Beverage & Non-Caffeinated
    { name: 'Mango Green Tea', category: 'Fruit Tea', default_price: 4.75 },
    { name: 'Passion Chess', category: 'Fruit Tea', default_price: 5.25 },
    { name: 'Berry Lychee Burst', category: 'Fruit Tea', default_price: 5.50 },
    { name: 'Peach Tea w/ Honey Jelly', category: 'Fruit Tea', default_price: 5.25 },
    { name: 'Mango & Passion Fruit Tea', category: 'Fruit Tea', default_price: 5.00 },
    { name: 'Honey Lemonade', category: 'Fruit Tea', default_price: 4.50 },
    { name: 'Tiger Boba', category: 'Fruit Tea', default_price: 5.75 }, 
    { name: 'Strawberry Coconut', category: 'Fruit Tea', default_price: 5.50 },
    { name: 'Strawberry Coconut Ice Blended', category: 'Slush', default_price: 6.25 },
    { name: 'Halo Halo', category: 'Fruit Tea', default_price: 6.50 },
    { name: 'Halo Halo Ice Blended', category: 'Slush', default_price: 7.00 },
    { name: 'Wintermelon Lemonade', category: 'Fruit Tea', default_price: 4.50 },
    { name: 'Wintermelon Lemonade Ice Blended', category: 'Slush', default_price: 5.25 },
    { name: 'Wintermelon w/ Fresh Milk', category: 'Fruit Tea', default_price: 5.00 },
  
    // Matcha Series
    { name: 'Matcha Pearl Milk Tea', category: 'Matcha', default_price: 5.50 },
    { name: 'Matcha Fresh Milk', category: 'Matcha', default_price: 5.75 },
    { name: 'Strawberry Matcha Fresh Milk', category: 'Matcha', default_price: 6.25 },
    { name: 'Mango Matcha Fresh Milk', category: 'Matcha', default_price: 6.25 },
    { name: 'Matcha Ice Blended', category: 'Slush', default_price: 6.50 },
  
    // Ice-Blended
    { name: 'Oreo w/ Pearl', category: 'Slush', default_price: 6.00 },
    { name: 'Taro w/ Pudding', category: 'Slush', default_price: 6.00 },
    { name: 'Thai Tea w/ Pearl', category: 'Slush', default_price: 6.00 },
    { name: 'Coffee w/ Ice Cream', category: 'Slush', default_price: 6.50 },
    { name: 'Mango w/ Ice Cream', category: 'Slush', default_price: 6.00 },
    { name: 'Strawberry w/ Lychee Jelly & Ice Cream', category: 'Slush', default_price: 6.50 },
    { name: 'Peach Tea w/ Lychee Jelly', category: 'Slush', default_price: 5.50 },
    { name: 'Lava Flow', category: 'Slush', default_price: 6.50 },
  ];

  return SHARETEA_MENU.map((item, i) => ({
    id: i + 1,
    name: item.name,
    description: "Delicious " + item.name,
    category: item.category,
    default_price: item.default_price,
    image_url: '/images/placeholder.png',
    is_available: true
  }));
}

function buildProductInventory(menuItems) {
  // Just map random products to inventory for seed to satisfy foreign constraints
  return menuItems.map(item => ({
    ProductID: item.id,
    InventoryID: 1
  }));
}

function buildTransactions(menuItems, count) {
  const transactions = [];
  const transactionItems = [];
  const orderItems = [];
  let txItemId = 1;

  for (let txId = 1; txId <= count; txId++) {
    const lines = randomInt(1, 4);
    const chosen = [];
    let total = 0;

    for (let i = 0; i < lines; i++) {
      const product = pick(menuItems);
      const qty = randomInt(1, 3);
      total += product.default_price * qty;
      chosen.push({
        TransactionItemID: txItemId++,
        TransactionID: txId,
        ProductID: product.id,
        Quantity: qty,
        PriceAtPurchase: product.default_price.toFixed(2),
      });

      orderItems.push({
        order_id: txId,
        menu_item_id: product.id,
        quantity: qty,
        customization: randomInt(1, 100) <= 80 ? randomCustomizationJson() : '',
        price_at_time: product.default_price.toFixed(2),
      });
    }

    transactions.push({
      TransactionID: txId,
      TransactionTimestamp: isoDateHoursAgo(randomInt(1, 24 * 7)),
      TotalAmount: total.toFixed(2),
    });
    transactionItems.push(...chosen);
  }

  return { transactions, transactionItems, orderItems };
}

function main() {
  ensureDir();

  const users = buildUsers();
  const inventory = buildInventory();
  const menuItems = buildMenuItems();
  const productInventory = buildProductInventory(menuItems);
  const txCount = randomInt(40, 70);
  const { transactions, transactionItems, orderItems } = buildTransactions(menuItems, txCount);

  writeCsv('users.csv', ['id', 'name', 'role', 'email'], users);
  writeCsv('inventory.csv', ['id', 'name', 'category', 'quantity', 'unit', 'restock_threshold'], inventory);
  writeCsv('menu_items.csv', ['id', 'name', 'description', 'category', 'default_price', 'image_url', 'is_available'], menuItems);
  writeCsv('product_inventory.csv', ['ProductID', 'InventoryID'], productInventory);
  writeCsv('transactions.csv', ['TransactionID', 'TransactionTimestamp', 'TotalAmount'], transactions);
  writeCsv('transaction_items.csv', ['TransactionItemID', 'TransactionID', 'ProductID', 'Quantity', 'PriceAtPurchase'], transactionItems);
  writeCsv('order_items.csv', ['order_id', 'menu_item_id', 'quantity', 'customization', 'price_at_time'], orderItems);

  console.log(`Generated seed CSV files in ${OUT_DIR} (transactions: ${txCount})`);
}

main();
