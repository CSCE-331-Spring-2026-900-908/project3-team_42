const jwt = require('jsonwebtoken');

const TOKEN_KIND = 'customer';

function getJwtSecret() {
  const secret = process.env.AUTH_JWT_SECRET;
  if (!secret) {
    throw new Error(
      'AUTH_JWT_SECRET is not set. Add it to backend/.env (use a long random string; never commit).'
    );
  }
  return secret;
}

function signCustomerSession(customerAccountId) {
  return jwt.sign(
    { typ: TOKEN_KIND, cid: customerAccountId },
    getJwtSecret(),
    { expiresIn: process.env.AUTH_JWT_EXPIRES_IN || '7d' }
  );
}

function verifyCustomerSessionToken(token) {
  const payload = jwt.verify(token, getJwtSecret());
  if (payload.typ !== TOKEN_KIND) {
    throw new Error('Invalid session token');
  }
  const cid = Number(payload.cid);
  if (!Number.isFinite(cid)) {
    throw new Error('Invalid session token');
  }
  return cid;
}

/**
 * Parses Authorization: Bearer <token> and returns customer account id, or null if missing/invalid.
 * Does not throw on malformed header (returns null).
 */
function tryGetCustomerIdFromAuthHeader(authHeader) {
  if (!authHeader || typeof authHeader !== 'string') return null;
  const m = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!m) return null;
  try {
    return verifyCustomerSessionToken(m[1].trim());
  } catch {
    return null;
  }
}

module.exports = {
  signCustomerSession,
  verifyCustomerSessionToken,
  tryGetCustomerIdFromAuthHeader,
};
