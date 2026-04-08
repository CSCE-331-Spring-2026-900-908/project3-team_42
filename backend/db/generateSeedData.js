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
  return [
    { id: 1, name: 'Classic Milk Tea', description: 'Traditional black milk tea with boba.', category: 'Milk Tea', default_price: 4.5, image_url: '/images/classic_milk_tea.png', is_available: true },
    { id: 2, name: 'Taro Milk Tea', description: 'Creamy taro root blended with milk tea.', category: 'Milk Tea', default_price: 5.0, image_url: '/images/taro_milk_tea.png', is_available: true },
    { id: 3, name: 'Mango Green Tea', description: 'Refreshing jasmine green tea with mango syrup.', category: 'Fruit Tea', default_price: 4.75, image_url: '/images/mango_green_tea.png', is_available: true },
    { id: 4, name: 'Strawberry Slush', description: 'Ice blended strawberry over green tea.', category: 'Slush', default_price: 5.5, image_url: '/images/strawberry_slush.png', is_available: true },
    { id: 5, name: 'Brown Sugar Boba', description: 'Fresh milk with warm brown sugar glaze and boba.', category: 'Specialty', default_price: 5.75, image_url: '/images/brown_sugar_boba.png', is_available: true },
  ];
}

function buildProductInventory() {
  return [
    { ProductID: 1, InventoryID: 2 }, { ProductID: 1, InventoryID: 4 }, { ProductID: 1, InventoryID: 1 }, { ProductID: 1, InventoryID: 11 }, { ProductID: 1, InventoryID: 12 },
    { ProductID: 2, InventoryID: 2 }, { ProductID: 2, InventoryID: 4 }, { ProductID: 2, InventoryID: 7 }, { ProductID: 2, InventoryID: 1 }, { ProductID: 2, InventoryID: 11 }, { ProductID: 2, InventoryID: 12 },
    { ProductID: 3, InventoryID: 10 }, { ProductID: 3, InventoryID: 3 }, { ProductID: 3, InventoryID: 6 }, { ProductID: 3, InventoryID: 11 }, { ProductID: 3, InventoryID: 12 },
    { ProductID: 4, InventoryID: 3 }, { ProductID: 4, InventoryID: 9 }, { ProductID: 4, InventoryID: 11 }, { ProductID: 4, InventoryID: 12 },
    { ProductID: 5, InventoryID: 4 }, { ProductID: 5, InventoryID: 8 }, { ProductID: 5, InventoryID: 1 }, { ProductID: 5, InventoryID: 11 }, { ProductID: 5, InventoryID: 12 },
  ];
}

function buildTransactions(menuItems, count) {
  const transactions = [];
  const transactionItems = [];
  let txItemId = 1;

  for (let txId = 1; txId <= count; txId++) {
    const lines = randomInt(1, 3);
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
    }

    transactions.push({
      TransactionID: txId,
      TransactionTimestamp: isoDateHoursAgo(randomInt(1, 24 * 7)),
      TotalAmount: total.toFixed(2),
    });
    transactionItems.push(...chosen);
  }

  return { transactions, transactionItems };
}

function main() {
  ensureDir();

  const users = buildUsers();
  const inventory = buildInventory();
  const menuItems = buildMenuItems();
  const productInventory = buildProductInventory();
  const { transactions, transactionItems } = buildTransactions(menuItems, 60);

  writeCsv('users.csv', ['id', 'name', 'role', 'email'], users);
  writeCsv('inventory.csv', ['id', 'name', 'category', 'quantity', 'unit', 'restock_threshold'], inventory);
  writeCsv('menu_items.csv', ['id', 'name', 'description', 'category', 'default_price', 'image_url', 'is_available'], menuItems);
  writeCsv('product_inventory.csv', ['ProductID', 'InventoryID'], productInventory);
  writeCsv('transactions.csv', ['TransactionID', 'TransactionTimestamp', 'TotalAmount'], transactions);
  writeCsv('transaction_items.csv', ['TransactionItemID', 'TransactionID', 'ProductID', 'Quantity', 'PriceAtPurchase'], transactionItems);

  console.log(`Generated seed CSV files in ${OUT_DIR}`);
}

main();
