INSERT INTO users (name, role, email) VALUES
('Manager Reveille', 'manager', 'reveille.bubbletea@gmail.com'),
('Cashier Alice', 'cashier', 'alice@boba.com'),
('Self-Service Kiosk', 'cashier', 'kiosk@reveilleboba.local');

INSERT INTO inventory (name, category, quantity, unit, restock_threshold) VALUES
('Tapioca Pearls (Boba)', 'Topping', 500, 'oz', 100),
('Black Tea Leaves', 'Tea Base', 200, 'oz', 50),
('Green Tea Leaves', 'Tea Base', 150, 'oz', 50),
('Milk powder', 'Dairy', 300, 'oz', 100),
('Lychee Jelly', 'Topping', 200, 'oz', 50),
('Mango Syrup', 'Syrup', 100, 'pump', 20),
('Cups (Regular)', 'Packaging', 1000, 'count', 200),
('Straws (Large)', 'Packaging', 2000, 'count', 300);

INSERT INTO menu_items (name, description, category, default_price, image_url) VALUES
('Classic Milk Tea', 'Traditional black milk tea with boba.', 'Milk Tea', 4.50, '/images/classic_milk_tea.png'),
('Taro Milk Tea', 'Creamy taro root blended with milk tea.', 'Milk Tea', 5.00, '/images/taro_milk_tea.png'),
('Mango Green Tea', 'Refreshing jasmine green tea with mango syrup.', 'Fruit Tea', 4.75, '/images/mango_green_tea.png'),
('Strawberry Slush', 'Ice blended with real strawberries over green tea.', 'Slush', 5.50, '/images/strawberry_slush.png'),
('Brown Sugar Boba', 'Fresh milk with warm brown sugar glaze and boba.', 'Specialty', 5.75, '/images/brown_sugar_boba.png');
