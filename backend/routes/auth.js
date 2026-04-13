const express = require('express');
const db = require('../db/config');
const { verifyGoogleCredential } = require('../lib/googleIdToken');
const { signCustomerSession, verifyCustomerSessionToken } = require('../lib/customerSession');

const router = express.Router();

/**
 * Exchange Google One Tap / Sign-In ID token for an app session JWT.
 * Body: { credential: "<Google ID token JWT>" }
 */
router.post('/google', async (req, res) => {
  try {
    const { credential } = req.body || {};
    if (!credential || typeof credential !== 'string') {
      return res.status(400).json({ error: 'Missing credential' });
    }

    const profile = await verifyGoogleCredential(credential);
    if (!profile.email) {
      return res.status(400).json({ error: 'Google account has no email' });
    }

    const upsert = await db.query(
      `INSERT INTO customer_accounts (email, name, picture_url, oauth_provider, oauth_subject)
       VALUES ($1, $2, $3, 'google', $4)
       ON CONFLICT (oauth_provider, oauth_subject)
       DO UPDATE SET
         email = EXCLUDED.email,
         name = EXCLUDED.name,
         picture_url = EXCLUDED.picture_url,
         updated_at = CURRENT_TIMESTAMP
       RETURNING id, email, name, picture_url`,
      [profile.email, profile.name || profile.email, profile.picture, profile.subject]
    );

    const row = upsert.rows[0];
    const token = signCustomerSession(row.id);

    res.json({
      token,
      user: {
        id: row.id,
        email: row.email,
        name: row.name,
        pictureUrl: row.picture_url,
      },
    });
  } catch (err) {
    const msg = err.message || 'Authentication failed';
    const status = msg.includes('not set') ? 500 : 401;
    res.status(status).json({ error: msg });
  }
});

/**
 * Return current customer from Bearer session JWT.
 */
router.get('/me', async (req, res) => {
  const authHeader = req.headers.authorization;
  const m = authHeader && String(authHeader).match(/^Bearer\s+(.+)$/i);
  if (!m) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  try {
    const customerId = verifyCustomerSessionToken(m[1].trim());
    const result = await db.query(
      'SELECT id, email, name, picture_url FROM customer_accounts WHERE id = $1',
      [customerId]
    );
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Account not found' });
    }
    const u = result.rows[0];
    res.json({
      user: {
        id: u.id,
        email: u.email,
        name: u.name,
        pictureUrl: u.picture_url,
      },
    });
  } catch {
    res.status(401).json({ error: 'Invalid or expired session' });
  }
});

module.exports = router;
