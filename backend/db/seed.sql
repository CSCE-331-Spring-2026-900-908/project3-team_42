INSERT INTO users (name, role, email) VALUES
('Manager Reveille', 'manager', 'reveille.bubbletea@gmail.com'),
('Cashier Alice', 'cashier', 'alice@boba.com'),
('Self-Service Kiosk', 'cashier', 'kiosk@reveilleboba.local');

INSERT INTO inventory (name, category, quantity, unit, restock_threshold) VALUES
('Tapioca Pearls (Boba)', 'Topping', 500, 'oz', 100),
('Black Tea Leaves', 'Tea Base', 200, 'oz', 50),
('Green Tea Leaves', 'Tea Base', 150, 'oz', 50),
('Milk Powder', 'Dairy', 300, 'oz', 100),
('Lychee Jelly', 'Topping', 200, 'oz', 50),
('Mango Syrup', 'Syrup', 100, 'pump', 20),
('Taro Powder', 'Powder', 150, 'oz', 40),
('Matcha Powder', 'Powder', 120, 'oz', 30),
('Brown Sugar Syrup', 'Syrup', 80, 'pump', 20),
('Strawberry Syrup', 'Syrup', 90, 'pump', 20),
('Peach Syrup', 'Syrup', 90, 'pump', 20),
('Honeydew Syrup', 'Syrup', 80, 'pump', 20),
('Avocado Puree', 'Fruit Base', 60, 'oz', 15),
('Espresso Shots', 'Coffee Base', 200, 'oz', 50),
('Chai Concentrate', 'Tea Base', 100, 'oz', 25),
('Oolong Tea Leaves', 'Tea Base', 120, 'oz', 30),
('Jasmine Tea Leaves', 'Tea Base', 120, 'oz', 30),
('Cups (Regular)', 'Packaging', 1000, 'count', 200),
('Straws (Large)', 'Packaging', 2000, 'count', 300);

INSERT INTO menu_items (name, description, category, default_price, image_url) VALUES
('Classic Milk Tea', 'Traditional black milk tea with boba.', 'Milk Tea', 4.50, '/images/classic_milk_tea.png'),
('Taro Milk Tea', 'Creamy taro root blended with milk tea.', 'Milk Tea', 5.00, '/images/taro_milk_tea.png'),
('Mango Green Tea', 'Refreshing jasmine green tea with mango syrup.', 'Fruit Tea', 4.75, '/images/mango_green_tea.png'),
('Strawberry Slush', 'Ice blended with real strawberries over green tea.', 'Slush', 5.50, '/images/strawberry_slush.png'),
('Brown Sugar Boba', 'Fresh milk with warm brown sugar glaze and boba.', 'Specialty', 5.75, '/images/brown_sugar_boba.png');

-- ProductInventory: maps each menu item to the inventory ingredients it consumes.
-- Menu IDs:  1=Classic Milk Tea, 2=Taro Milk Tea, 3=Mango Green Tea, 4=Strawberry Slush, 5=Brown Sugar Boba
-- Inv  IDs:  1=Tapioca Pearls, 2=Black Tea, 3=Green Tea, 4=Milk Powder, 6=Mango Syrup,
--            7=Taro Powder, 9=Brown Sugar Syrup, 10=Strawberry Syrup, 17=Jasmine Tea, 18=Cups, 19=Straws
INSERT INTO ProductInventory (ProductID, InventoryID) VALUES
-- Classic Milk Tea → black tea, milk powder, boba, cup, straw
(1, 2), (1, 4), (1, 1), (1, 18), (1, 19),
-- Taro Milk Tea → black tea, milk powder, taro powder, boba, cup, straw
(2, 2), (2, 4), (2, 7), (2, 1), (2, 18), (2, 19),
-- Mango Green Tea → jasmine tea, green tea, mango syrup, cup, straw
(3, 17), (3, 3), (3, 6), (3, 18), (3, 19),
-- Strawberry Slush → green tea, strawberry syrup, cup, straw
(4, 3), (4, 10), (4, 18), (4, 19),
-- Brown Sugar Boba → milk powder, brown sugar syrup, boba, cup, straw
(5, 4), (5, 9), (5, 1), (5, 18), (5, 19);

-- Manager report state singleton (required by X-report and Z-report endpoints)
INSERT INTO manager_report_state (singleton_id, business_day_start) VALUES
(1, CURRENT_TIMESTAMP);

-- Sample sales history (orders + line items) for demo / reporting
INSERT INTO orders (cashier_id, total_amount, status) VALUES
(2, 14.50, 'completed'),
(3, 10.25, 'completed');

INSERT INTO order_items (order_id, menu_item_id, quantity, customization, price_at_time) VALUES
(1, 1, 1, '{"ice": "50%", "sugar": "100%", "toppings": ["boba"]}'::jsonb, 4.50),
(1, 2, 2, '{"ice": "50%", "sugar": "70%"}'::jsonb, 5.00),
(2, 3, 1, '{"ice": "100%", "sugar": "50%"}'::jsonb, 4.75),
(2, 4, 1, NULL, 5.50);
