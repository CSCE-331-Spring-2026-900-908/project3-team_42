import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateCustomizedDrinkPrice,
  DEFAULT_SIZE_OPTION,
  SIZE_OPTIONS,
} from './drinkCustomization.js';

test('12oz is the default size and does not add an upcharge', () => {
  assert.equal(DEFAULT_SIZE_OPTION.id, '12oz');
  assert.equal(calculateCustomizedDrinkPrice({ basePrice: 5, toppingCount: 0, sizeId: '12oz' }), 5);
});

test('16oz adds 50 cents and 24oz adds 1 dollar', () => {
  assert.deepEqual(
    SIZE_OPTIONS.map((size) => [size.id, size.upcharge]),
    [
      ['12oz', 0],
      ['16oz', 0.5],
      ['24oz', 1],
    ]
  );
  assert.equal(calculateCustomizedDrinkPrice({ basePrice: 5, toppingCount: 0, sizeId: '16oz' }), 5.5);
  assert.equal(calculateCustomizedDrinkPrice({ basePrice: 5, toppingCount: 0, sizeId: '24oz' }), 6);
});

test('size and topping upcharges combine into one custom drink price', () => {
  assert.equal(calculateCustomizedDrinkPrice({ basePrice: 5, toppingCount: 2, sizeId: '24oz' }), 7);
});
