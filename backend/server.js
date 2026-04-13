const express = require('express');
const cors = require('cors');
require('dotenv').config();
const apiRoutes = require('./routes/api');
const authRoutes = require('./routes/auth');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Backend is running' });
});

app.use('/api/auth', authRoutes);
app.use('/api', apiRoutes);

// Only listen locally, Vercel will automatically manage the exported app function
if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);

    if (!process.env.GOOGLE_CLIENT_ID) {
      console.warn(
        '[auth] GOOGLE_CLIENT_ID is unset - customer kiosk sign-in will fail until it matches VITE_GOOGLE_CLIENT_ID.',
      );
    }

    if (!process.env.AUTH_JWT_SECRET) {
      console.warn(
        '[auth] AUTH_JWT_SECRET is unset - customer sessions cannot be issued or verified.',
      );
    }
  });
}

module.exports = app;
