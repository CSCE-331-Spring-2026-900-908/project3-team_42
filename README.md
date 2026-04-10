# Team 42 — Bubble Tea POS (Project 3)

A web-based point-of-sale system for an imaginary bubble tea shop. It combines a **React** storefront and staff UIs with a **Node.js / Express** API and **PostgreSQL** on the course TAMU database host. The app is built for CSCE-style coursework: multiple in-store roles (manager, cashier, customer kiosk, menu board), external APIs (auth, translation, weather, and an AI menu assistant), and accessibility-minded UI on the customer flow.

## What’s in the app

| Route | Audience | Purpose |
|-------|----------|---------|
| `/` | Staff setup | **Portal** — single entry that links to each interface (interfaces do not link back). |
| `/manager` | Manager | Google sign-in; inventory overview (and placeholders for later menu/financial tools). |
| `/cashier` | Cashier | Touch-oriented POS: browse menu, cart, checkout to the database. |
| `/customer` | Lobby kiosk | Self-service menu, optional Spanish translation, cart/checkout, and a Gemini-powered menu chat. |
| `/menuboard` | Public display | Large, non-interactive board with featured categories and local weather. |

## Tech stack

- **Frontend:** React (Vite), React Router, Tailwind CSS, Axios  
- **Backend:** Express.js, `pg` (PostgreSQL)  
- **Database:** PostgreSQL (course server; schema and seeds in `backend/db/`)  
- **Deployment:** Intended for hosts such as Render (frontend + API); configure URLs via environment variables  

## Prerequisites

- **Node.js** (LTS recommended)  
- **npm**  
- Access to your team’s **PostgreSQL** database (host, user, database name, password from course / Project 2)  
- API keys for **Google OAuth** (manager), **Google Cloud Translation**, and **Google Gemini** (see below)  

## Local setup

### 1. Database

Copy the template and fill in **only** on your machine (never commit `backend/.env`):

```bash
cd backend
cp .env.example .env
```

Edit `backend/.env` with your team’s PostgreSQL host, user, database name, and password. The app **requires** these variables; there are no database defaults in source code.

Apply schema and seed (from the `backend` folder):

```bash
cd backend
node db/init.js
```

`db/init.js` now mirrors Project 2's flow: it generates CSV seed files in `backend/db/seed-data/` and then loads them through SQL (`schema.sql` + `seed.sql` via `psql \copy`) so report data comes from generated files rather than hardcoded SQL inserts.
Randomized transactional/order sample data is generated directly by `generateSeedData.js`, so there is no separate fake-data step.

### 2. Backend

```bash
cd backend
npm install
```

Add translation and chat keys to the same `backend/.env` (see `backend/.env.example`):

```env
GOOGLE_TRANSLATE_API_KEY=your-key
GEMINI_API_KEY=your-key
PORT=3000
```

Start the API:

```bash
node server.js
```

Health check: `GET http://localhost:3000/api/health`

### 3. Frontend

```bash
cd frontend
npm install
cp .env.example .env.local
```

Edit `.env.local`:

```env
VITE_API_URL=http://localhost:3000
VITE_GOOGLE_CLIENT_ID=your-google-oauth-web-client-id.apps.googleusercontent.com
```

Start the dev server:

```bash
npm run dev
```

Open the URL Vite prints (typically `http://localhost:5173`).

### 4. Google Cloud OAuth

In the [Google Cloud Console](https://console.cloud.google.com/), add **Authorized JavaScript origins** for your local dev origin (e.g. `http://localhost:5173`) and your production frontend URL when deployed.

## Environment variables (summary)

| Where | Variable | Purpose |
|-------|----------|---------|
| Frontend | `VITE_API_URL` | Backend origin (no `/api` suffix). Defaults to `http://localhost:3000`. |
| Frontend | `VITE_GOOGLE_CLIENT_ID` | Google OAuth **Web client ID** (intentionally public in the browser; not a secret). |
| Backend | `DB_HOST`, `DB_USER`, `DB_NAME`, `DB_PASSWORD` | **Required.** PostgreSQL connection — set only in `backend/.env`. |
| Backend | `GOOGLE_TRANSLATE_API_KEY` | Proxies translation requests for the customer kiosk. |
| Backend | `GEMINI_API_KEY` | Menu chat assistant (`POST /api/chat`). |
| Backend | `PORT` | HTTP port (Render sets this in production). |

## HTTP API (Express, base path `/api`)

All routes are JSON unless noted.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Liveness / sanity check. |
| `GET` | `/menu` | Active menu items (`is_available = true`). |
| `GET` | `/inventory` | Inventory rows (manager-facing). |
| `GET` | `/employees` | Users table. |
| `POST` | `/orders` | Create an order and line items. Body: `cashier_id`, `total_amount`, `items[]` (`menu_item_id`, `quantity`, `customization`, `price`). |
| `POST` | `/translate` | Body: `{ text, target }` — returns `{ translatedText }` via Google Translate. |
| `GET` | `/weather` | Returns temperature, unit, short forecast, and icon via NOAA **api.weather.gov** (no API key). |
| `POST` | `/chat` | Body: `{ message, menuContext, language }` — Gemini reply for the kiosk assistant. |

## External services

| Service | Used for |
|---------|----------|
| **Google OAuth** | Manager login (`@react-oauth/google` on the client). |
| **Google Cloud Translation API** | Customer kiosk language toggle. |
| **NOAA weather.gov** | Menu board and weather strip (identifies the app via `User-Agent`). |
| **Google Gemini** (GenAI) | Customer “Boba Assistant” chat, proxied by the backend. |

## Production build (frontend)

```bash
cd frontend
npm run build
```

Point `VITE_API_URL` at your deployed API before building. Serve the `frontend/dist` output from your static host and ensure **CORS** on the backend allows your frontend origin.

## Project layout

```
backend/          Express app, `/api` routes, DB pool config, schema & seeds
frontend/         Vite + React app (views per role, shared API client)
```

## Security and public repositories

This project is safe to open-source **only if** secrets stay out of git:

- **Never commit** `backend/.env`, `frontend/.env`, or `frontend/.env.local`. Use `backend/.env.example` and `frontend/.env.example` as templates only.
- **Database passwords, Translation keys, and Gemini keys** must exist only in environment variables on your machine and on your host (e.g. Render). They must not appear in code, README, or issues.
- **Google OAuth Web client ID** (`VITE_GOOGLE_CLIENT_ID`) is expected to ship in the frontend bundle; restrict abuse in [Google Cloud Console](https://console.cloud.google.com/) using **HTTP referrer** / origin restrictions on the OAuth client.
- **API keys on the server** are loaded from `process.env` only; keep them on the backend. Do not prefix secret keys with `VITE_` (Vite exposes those to the browser).
- If anything was ever committed by mistake, **rotate** the database password and API keys, remove the leak from history (e.g. `git filter-repo` or BFG), and treat the old credentials as compromised.

## Team & course

**Team 42** — CSCE Project 3 (Agile sprints, accessibility, user studies). This repository is for coursework; keep credentials out of git and use your class organization’s GitHub workflow as required by the syllabus.
