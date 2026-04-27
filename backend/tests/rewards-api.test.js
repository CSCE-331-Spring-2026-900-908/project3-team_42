const test = require('node:test');
const assert = require('node:assert/strict');

function loadAppWithMocks({ dbResponses, customerId = null }) {
  process.env.VERCEL = '1';

  const modulePaths = [
    '/Users/shrutwik/Desktop/project3-team_42/backend/server.js',
    '/Users/shrutwik/Desktop/project3-team_42/backend/routes/api.js',
    '/Users/shrutwik/Desktop/project3-team_42/backend/routes/auth.js',
    '/Users/shrutwik/Desktop/project3-team_42/backend/db/config.js',
    '/Users/shrutwik/Desktop/project3-team_42/backend/lib/customerSession.js',
    '/Users/shrutwik/Desktop/project3-team_42/backend/lib/googleIdToken.js',
  ];

  for (const mod of modulePaths) {
    delete require.cache[require.resolve(mod)];
  }

  let responseIndex = 0;
  const db = {
    calls: [],
    async query(sql, params) {
      this.calls.push({ sql, params });
      const next = dbResponses[responseIndex++];
      if (next instanceof Error) {
        throw next;
      }
      return next || { rows: [] };
    },
    async end() {},
  };

  require.cache[require.resolve('/Users/shrutwik/Desktop/project3-team_42/backend/db/config.js')] = {
    exports: db,
  };
  require.cache[require.resolve('/Users/shrutwik/Desktop/project3-team_42/backend/lib/customerSession.js')] = {
    exports: {
      tryGetCustomerIdFromAuthHeader() {
        return customerId;
      },
      signCustomerSession() {
        return 'test-token';
      },
      verifyCustomerSessionToken() {
        return customerId;
      },
    },
  };
  require.cache[require.resolve('/Users/shrutwik/Desktop/project3-team_42/backend/lib/googleIdToken.js')] = {
    exports: {
      async verifyGoogleCredential() {
        return {
          email: 'customer@example.com',
          name: 'Customer',
          picture: null,
          subject: 'google-subject',
        };
      },
    },
  };

  const app = require('/Users/shrutwik/Desktop/project3-team_42/backend/server.js');
  return { app, db };
}

async function withServer(app, fn) {
  const server = app.listen(0);
  try {
    await new Promise((resolve) => server.once('listening', resolve));
    const { port } = server.address();
    await fn(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  }
}

test('customer kiosk rewards use checkout email as a persistent database account', async () => {
  const { app, db } = loadAppWithMocks({
    customerId: null,
    dbResponses: [
      { rows: [] },
      { rows: [{ id: 7, points_balance: 10 }] },
      { rows: [{ id: 101 }] },
      { rows: [] },
      { rows: [{ next_id: 500 }] },
      { rows: [{ next_id: 900 }] },
      { rows: [] },
      { rows: [] },
      { rows: [] },
      { rows: [] },
      { rows: [] },
      { rows: [] },
      { rows: [] },
      { rows: [{ points_balance: 12 }] },
    ],
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer kiosk-token',
      },
      body: JSON.stringify({
        cashier_id: 4,
        total_amount: 9.73,
        placed_via: 'customer_kiosk',
        customer_name: 'Taylor',
        customer_email: ' Taylor@Example.COM ',
        items: [
          {
            menu_item_id: 3,
            quantity: 2,
            price: 4.5,
            customization: { sweetness: '50%' },
          },
        ],
      }),
    });

    assert.equal(response.status, 201);
    const body = await response.json();
    assert.equal(body.id, 101);
    assert.match(body.orderNumber, /^[A-Z0-9]{4}$/);
    assert.equal(body.pointsEarned, 2);
    assert.equal(body.rewardsBalance, 12);
    assert.equal(body.freeBobaCount, 2);
    assert.equal(body.pointsToNextFreeBoba, 3);
  });

  const upsertCustomer = db.calls.find((call) => call.sql.includes('INSERT INTO customer_accounts'));
  assert.ok(upsertCustomer, 'expected customer account upsert');
  assert.deepEqual(upsertCustomer.params, ['taylor@example.com', 'Taylor']);

  const insertOrder = db.calls.find((call) => call.sql.includes('INSERT INTO orders'));
  assert.ok(insertOrder, 'expected order insert query');
  assert.equal(insertOrder.params[1], 7);
  assert.equal(insertOrder.params[3], 2);

  const ledgerInsert = db.calls.find((call) => call.sql.includes('INSERT INTO points_ledger'));
  assert.ok(ledgerInsert, 'expected points ledger insert');
  assert.deepEqual(ledgerInsert.params.slice(0, 4), [7, 'order', 2, 101]);
});

test('repeat kiosk checkout with same email increments the existing rewards balance', async () => {
  const { app, db } = loadAppWithMocks({
    customerId: null,
    dbResponses: [
      { rows: [] },
      { rows: [{ id: 7, points_balance: 12 }] },
      { rows: [{ id: 103 }] },
      { rows: [] },
      { rows: [{ next_id: 502 }] },
      { rows: [{ next_id: 902 }] },
      { rows: [] },
      { rows: [] },
      { rows: [] },
      { rows: [] },
      { rows: [] },
      { rows: [] },
      { rows: [] },
      { rows: [{ points_balance: 15 }] },
    ],
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        cashier_id: 4,
        total_amount: 13.5,
        placed_via: 'customer_kiosk',
        customer_name: 'Taylor',
        customer_email: 'taylor@example.com',
        items: [
          {
            menu_item_id: 4,
            quantity: 3,
            price: 4.5,
            customization: null,
          },
        ],
      }),
    });

    assert.equal(response.status, 201);
    const body = await response.json();
    assert.equal(body.id, 103);
    assert.equal(body.pointsEarned, 3);
    assert.equal(body.rewardsBalance, 15);
    assert.equal(body.freeBobaCount, 3);
    assert.equal(body.pointsToNextFreeBoba, 5);
  });

  const upsertCustomer = db.calls.find((call) => call.sql.includes('ON CONFLICT (email)'));
  assert.ok(upsertCustomer, 'expected email conflict-safe customer upsert');

  const balanceUpdate = db.calls.find((call) => call.sql.includes('SET points_balance = points_balance + $1'));
  assert.ok(balanceUpdate, 'expected persistent balance increment');
  assert.deepEqual(balanceUpdate.params, [3, 7]);
});

test('rewards endpoint returns the current signed-in customer balance', async () => {
  const { app } = loadAppWithMocks({
    customerId: 9,
    dbResponses: [
      { rows: [{ id: 9, name: 'Taylor', email: 'taylor@example.com', points_balance: 34 }] },
    ],
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/rewards/me`, {
      headers: {
        Authorization: 'Bearer kiosk-token',
      },
    });

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.deepEqual(body, {
      customer: {
        id: 9,
        name: 'Taylor',
        email: 'taylor@example.com',
      },
      pointsBalance: 34,
      freeBobaCount: 6,
      pointsToNextFreeBoba: 1,
    });
  });
});

test('guest kiosk orders do not create rewards activity', async () => {
  const { app, db } = loadAppWithMocks({
    customerId: null,
    dbResponses: [
      { rows: [] },
      { rows: [{ id: 102 }] },
      { rows: [] },
      { rows: [{ next_id: 501 }] },
      { rows: [{ next_id: 901 }] },
      { rows: [] },
      { rows: [] },
      { rows: [] },
      { rows: [] },
      { rows: [] },
      { rows: [] },
    ],
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        cashier_id: 4,
        total_amount: 4.5,
        placed_via: 'customer_kiosk',
        items: [
          {
            menu_item_id: 2,
            quantity: 1,
            price: 4.5,
            customization: null,
          },
        ],
      }),
    });

    assert.equal(response.status, 201);
    const body = await response.json();
    assert.match(body.orderNumber, /^[A-Z0-9]{4}$/);
    assert.equal(body.pointsEarned, 0);
    assert.equal(body.rewardsBalance, 0);
    assert.equal(body.freeBobaCount, 0);
    assert.equal(body.pointsToNextFreeBoba, 5);
  });

  const insertOrder = db.calls.find((call) => call.sql.includes('INSERT INTO orders'));
  assert.ok(insertOrder, 'expected order insert query');
  assert.equal(insertOrder.params[1], null);
  assert.equal(insertOrder.params[3], 0);

  const ledgerInsert = db.calls.find((call) => call.sql.includes('INSERT INTO points_ledger'));
  assert.equal(ledgerInsert, undefined);
});

test('cancelling a rewarded order reverses customer points', async () => {
  const { app, db } = loadAppWithMocks({
    customerId: 7,
    dbResponses: [
      { rows: [] },
      { rows: [{ id: 101, status: 'completed', transaction_id: 500, customer_account_id: 7, points_earned: 2 }] },
      { rows: [] },
      { rows: [] },
      { rows: [] },
      { rows: [] },
      { rows: [] },
    ],
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/orders/101/cancel`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer kiosk-token',
      },
    });

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.id, 101);
  });

  const ledgerInsert = db.calls.find((call) => call.sql.includes('INSERT INTO points_ledger'));
  assert.ok(ledgerInsert, 'expected points reversal ledger insert');
  assert.deepEqual(ledgerInsert.params.slice(0, 4), [7, 'order_reversal', -2, 101]);

  const balanceUpdate = db.calls.find((call) => call.sql.includes('SET points_balance = GREATEST(0, points_balance - $1)'));
  assert.ok(balanceUpdate, 'expected customer balance reversal');
  assert.deepEqual(balanceUpdate.params, [2, 7]);
});
