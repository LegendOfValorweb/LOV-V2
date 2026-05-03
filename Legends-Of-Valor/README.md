# Legends of Valor

An epic dark-fantasy browser RPG built with React, Express, TypeScript, and PostgreSQL.

---

## Project Structure

```
Legends-Of-Valor/
├── client/                 # React 18 + Vite frontend (SPA)
│   ├── src/
│   │   ├── pages/          # All game pages (base, guild, combat, shop …)
│   │   ├── components/     # Shared UI components (shadcn/ui)
│   │   ├── hooks/          # Custom React hooks
│   │   └── lib/            # queryClient, API helpers
│   └── index.html
├── server/                 # Express + TypeScript backend (API)
│   ├── index.ts            # Server entry — HTTP, CORS, logging, port
│   ├── routes.ts           # All REST API routes (~8 000 lines)
│   ├── auth.ts             # JWT auth middleware
│   ├── db.ts               # Drizzle ORM / PostgreSQL pool
│   ├── storage.ts          # Data-access layer
│   ├── game-ai.ts          # Google Gemini AI Game Master
│   └── vite.ts             # Vite dev-server middleware (dev only)
├── shared/
│   └── schema.ts           # Drizzle table definitions shared by client + server
├── script/
│   └── build.ts            # esbuild bundler for the backend
├── dist/                   # Production build output
│   ├── index.cjs           # Compiled backend (single CJS bundle)
│   └── public/             # Compiled frontend (static assets)
├── .env.example            # Template for required environment variables
├── vercel.json             # Vercel deployment config (frontend)
├── railway.json            # Railway deployment config (backend)
├── render.yaml             # Render deployment config (backend)
├── nixpacks.toml           # Nixpacks build config for Railway
├── drizzle.config.ts       # Drizzle Kit migrations config
└── DEPLOYMENT.md           # Step-by-step platform deployment guide
```

---

## Prerequisites

| Tool | Version |
|------|---------|
| Node.js | 20 LTS or later |
| npm | 10+ (bundled with Node 20) |
| PostgreSQL | 15+ (or any hosted provider) |

---

## Local Development

### 1. Install dependencies

```bash
cd Legends-Of-Valor
npm install
```

### 2. Set environment variables

```bash
cp .env.example .env
```

Open `.env` and fill in the values (see comments inside the file).
At minimum you need `DATABASE_URL` and `JWT_SECRET`.

### 3. Push the database schema

```bash
npm run db:push
```

This creates all tables in the PostgreSQL database pointed to by `DATABASE_URL`.

### 4. Start the development server

```bash
npm run dev
```

This starts the Express server (which also proxies Vite HMR) on **port 5000**.
Open [http://localhost:5000](http://localhost:5000) in your browser.

---

## Build for Production

```bash
# Build the backend → dist/index.cjs
npm run build:backend

# Build the frontend → dist/public
npm run build:frontend

# Or build both at once
npm run build
```

### Run the production build locally

```bash
# Start the compiled server
NODE_ENV=production DATABASE_URL=... JWT_SECRET=... npm start
```

If you also want the backend to serve the frontend (single-server mode), set:

```bash
SERVE_STATIC=true npm start
```

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_SECRET` | Yes | Long random secret for signing JWTs |
| `FRONTEND_URL` | Prod only | Exact origin of the deployed frontend — used for CORS (e.g. `https://your-app.vercel.app`) |
| `GOOGLE_API_KEY` | Yes | Google Generative AI key for the AI Game Master |
| `PORT` | No | Server port (default: `5000`) |
| `NODE_ENV` | No | `development` or `production` (default: `development`) |
| `SERVE_STATIC` | No | Set to `"true"` to serve frontend from `dist/public` (single-server mode) |

**Frontend** (set in Vercel / your host):

| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | Full backend URL when frontend and backend are on different origins (e.g. `https://your-backend.onrender.com`). Leave blank when using Vercel API proxy rewrites. |

---

## Deploying to Vercel + Render (Recommended)

The recommended split is **Vercel** for the frontend and **Render** (or Railway) for the backend.

See **[DEPLOYMENT.md](./DEPLOYMENT.md)** for the full step-by-step guide.

### Quick summary

1. Deploy the backend on Render or Railway first.
2. Note the public backend URL (e.g. `https://legends-of-valor-backend.onrender.com`).
3. Update `vercel.json` — replace `YOUR_RENDER_SERVICE` with your actual Render subdomain.
4. Deploy the frontend on Vercel.
5. In the Render/Railway dashboard, set `FRONTEND_URL` to your Vercel URL.

---

## Deploying to Railway (Backend Only)

`railway.json` and `nixpacks.toml` are already configured.

```bash
# Install the Railway CLI
npm i -g @railway/cli

# Login and link project
railway login
railway link

# Deploy
railway up
```

Set environment variables in the Railway dashboard under **Variables**.

---

## Deploying to Render (Backend Only)

`render.yaml` is already configured. In the Render dashboard:

1. Click **New → Blueprint** and point to this repository.
2. Render auto-detects `render.yaml` and creates the `legends-of-valor-backend` service.
3. Set `DATABASE_URL`, `JWT_SECRET`, `FRONTEND_URL`, and `GOOGLE_API_KEY` in the **Environment** tab.

---

## API Health Check

```
GET /api/health
```

Returns `{ "status": "ok", "timestamp": "..." }`. Used by Railway and Render for liveness probes.

---

## Database Migrations

```bash
# Push schema changes to the database
npm run db:push

# (requires DATABASE_URL to be set in the environment)
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite 7, TailwindCSS, shadcn/ui, Wouter, TanStack Query |
| Backend | Express 4, TypeScript, tsx (dev), esbuild (prod) |
| Database | PostgreSQL, Drizzle ORM |
| Auth | JWT (Bearer token + httpOnly cookie) |
| AI | Google Gemini 1.5 Flash |
| Deployment | Vercel (frontend), Render / Railway (backend) |
