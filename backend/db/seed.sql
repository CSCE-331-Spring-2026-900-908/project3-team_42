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
-- Milk Teas
('Classic Milk Tea',     'Traditional black milk tea with boba.',               'Milk Tea', 4.50, '/images/classic_milk_tea.png'),
('Taro Milk Tea',        'Creamy taro root blended with milk tea.',             'Milk Tea', 5.00, '/images/taro_milk_tea.png'),
('Matcha Milk Tea',      'Earthy matcha powder blended with creamy milk tea.',  'Milk Tea', 5.25, '/images/matcha_milk_tea.png'),
('Brown Sugar Milk Tea', 'Fresh milk with warm brown sugar glaze and boba.',    'Milk Tea', 5.75, '/images/brown_sugar_milk_tea.png'),
('Thai Milk Tea',        'Spiced black tea with sweetened condensed milk.',     'Milk Tea', 5.00, '/images/thai_milk_tea.png'),
('Oolong Milk Tea',      'Smooth oolong tea blended with creamy milk.',         'Milk Tea', 4.75, '/images/oolong_milk_tea.png'),
('Jasmine Milk Tea',     'Floral jasmine tea with a silky milk base.',          'Milk Tea', 4.75, '/images/jasmine_milk_tea.png'),
-- Smoothies
('Honeydew Smoothie',   'Sweet honeydew melon blended into a creamy smoothie.','Smoothie', 5.50, '/images/honeydew_smoothie.png'),
('Strawberry Smoothie', 'Bright strawberry blended with milk and ice.',         'Smoothie', 5.50, '/images/strawberry_smoothie.png'),
('Mango Smoothie',      'Tropical mango blended smooth and sweet.',             'Smoothie', 5.50, '/images/mango_smoothie.png'),
('Peach Smoothie',      'Fresh peach blended to creamy perfection.',            'Smoothie', 5.50, '/images/peach_smoothie.png'),
('Avocado Smoothie',    'Rich avocado with milk for a velvety smooth drink.',   'Smoothie', 5.75, '/images/avocado_smoothie.png'),
-- Coffee
('Coffee Latte',        'Espresso with steamed milk, light and smooth.',        'Coffee', 4.75, '/images/coffee_latte.png'),
('Mocha Latte',         'Espresso, chocolate, and steamed milk combined.',      'Coffee', 5.25, '/images/mocha_latte.png'),
('Caramel Latte',       'Espresso with caramel syrup and steamed milk.',        'Coffee', 5.25, '/images/caramel_latte.png'),
('Vanilla Latte',       'Smooth espresso with vanilla and steamed milk.',       'Coffee', 5.25, '/images/vanilla_latte.png'),
('Americano',           'Bold espresso shots diluted with hot water.',          'Coffee', 3.75, '/images/americano.png'),
('Cappuccino',          'Espresso topped with thick, frothy steamed milk.',     'Coffee', 4.50, '/images/cappuccino.png'),
-- Tea
('Matcha Latte',        'Ceremonial matcha whisked with steamed milk.',         'Tea', 5.25, '/images/matcha_latte.png'),
('Chai Latte',          'Spiced chai concentrate blended with steamed milk.',   'Tea', 4.75, '/images/chai_latte.png'),
('Black Tea',           'Classic brewed black tea, served hot or iced.',        'Tea', 3.50, '/images/black_tea.png'),
('Green Tea',           'Light and refreshing brewed green tea.',               'Tea', 3.50, '/images/green_tea.png');