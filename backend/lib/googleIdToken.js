const { OAuth2Client } = require('google-auth-library');

let client;

function getClient() {
  const id = process.env.GOOGLE_CLIENT_ID;
  if (!id) {
    throw new Error(
      'GOOGLE_CLIENT_ID is not set. Use the same OAuth 2.0 Web client ID as VITE_GOOGLE_CLIENT_ID in backend/.env.'
    );
  }
  if (!client) {
    client = new OAuth2Client(id);
  }
  return client;
}

/**
 * Verifies a Google Sign-In ID token (credential JWT) and returns profile fields.
 */
async function verifyGoogleCredential(idToken) {
  const ticket = await getClient().verifyIdToken({
    idToken,
    audience: process.env.GOOGLE_CLIENT_ID,
  });
  const p = ticket.getPayload();
  if (!p || !p.sub) {
    throw new Error('Invalid Google token payload');
  }
  return {
    subject: p.sub,
    email: p.email || '',
    name: p.name || '',
    picture: p.picture || null,
  };
}

module.exports = { verifyGoogleCredential };
