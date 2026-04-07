require('dotenv').config();
const express = require('express');
const session = require('express-session');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(session({
  secret: process.env.SESSION_SECRET || 'fallback-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false,
    maxAge: 24 * 60 * 60 * 1000
  }
}));

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/auth/strava', (req, res) => {
  const clientId = process.env.STRAVA_CLIENT_ID;
  const redirectUri = process.env.STRAVA_REDIRECT_URI || `http://localhost:${PORT}/auth/strava/callback`;
  const scope = 'read,activity:read_all';

  const authUrl = `https://www.strava.com/oauth/authorize` +
    `?client_id=${clientId}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&response_type=code` +
    `&scope=${encodeURIComponent(scope)}`;

  res.redirect(authUrl);
});

app.get('/auth/strava/callback', async (req, res) => {
  const { code, error } = req.query;

  if (error) {
    return res.redirect('/?error=' + encodeURIComponent(error));
  }

  if (!code) {
    return res.redirect('/?error=no_code');
  }

  try {
    const tokenResponse = await axios.post('https://www.strava.com/oauth/token', {
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      code: code,
      grant_type: 'authorization_code'
    });

    const { access_token, refresh_token, expires_at, athlete } = tokenResponse.data;

    req.session.accessToken = access_token;
    req.session.refreshToken = refresh_token;
    req.session.expiresAt = expires_at;
    req.session.athlete = athlete;

    res.redirect('/');
  } catch (err) {
    const errorMsg = err.response?.data?.message || 'Token exchange failed';
    res.redirect('/?error=' + encodeURIComponent(errorMsg));
  }
});

app.get('/auth/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

app.get('/api/athlete', (req, res) => {
  if (!req.session.athlete || !req.session.accessToken) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  res.json({
    athlete: req.session.athlete,
    accessToken: req.session.accessToken,
    expiresAt: req.session.expiresAt
  });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
