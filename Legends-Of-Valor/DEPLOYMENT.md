# Deployment Guide: Frontend (Vercel) + Backend (Railway)

This guide explains how to deploy Legend of Valor with the frontend on Vercel and the backend on Railway.

## Prerequisites

- A Vercel account (https://vercel.com)
- A Railway account (https://railway.app)
- A PostgreSQL database (Railway provides one, or use your existing database)

## Step 1: Deploy Backend to Railway

### 1.1 Create a new Railway project

1. Go to https://railway.app and create a new project
2. Select "Deploy from GitHub repo" and connect this repository
3. **Important:** In the Railway project settings, set the **Root Directory** to `Legends-Of-Valor`
4. Railway will auto-detect the configuration from `railway.json` and `nixpacks.toml`

### 1.2 Add PostgreSQL Database

1. In your Railway project, click "+ New" and select "Database" → "PostgreSQL"
2. Railway will automatically set the `DATABASE_URL` environment variable

### 1.3 Configure Environment Variables

In Railway's project settings, add:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | (Auto-set by Railway PostgreSQL) |
| `FRONTEND_URL` | Your Vercel frontend URL (e.g., `https://your-app.vercel.app`) — exact origin, no trailing slash |
| `JWT_SECRET` | A long random secret string for signing auth tokens |
| `OPENAI_API_KEY` | Your OpenAI API key for AI Game Master |

> **Note:** Do **not** set `SERVE_STATIC=true` on Railway. The Railway backend is an API-only deployment — static frontend files are not present and not needed. The `SERVE_STATIC` flag is only for environments where both the backend and built frontend assets are co-located (e.g., a single-server Replit deployment).

> **Important:** `FRONTEND_URL` must be the exact Vercel origin (no trailing slash). The CORS middleware uses an exact-match allowlist for security — only the URL you specify will be permitted to make credentialed cross-origin requests.

### 1.4 Get your Railway Backend URL

After deployment, note your Railway app URL (e.g., `https://your-app.up.railway.app`)

## Step 2: Deploy Frontend to Vercel

### 2.1 Create a new Vercel project

1. Go to https://vercel.com and create a new project
2. Import this repository from GitHub
3. **Important:** In Vercel project settings, set the **Root Directory** to `Legends-Of-Valor`
4. Vercel will auto-detect the configuration from `vercel.json`

### 2.2 Configure Environment Variables

In Vercel's project settings → Environment Variables, add:

| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | Your Railway backend URL (e.g., `https://your-app.up.railway.app`) — exact origin, no trailing slash |

> **Important:** `VITE_API_URL` must be set before building. The frontend bakes this value in at build time via `import.meta.env.VITE_API_URL`. Without it, all API calls go to the Vercel domain and return 404s.

### 2.3 Deploy

Click "Deploy" and Vercel will build the frontend using `npm run build:frontend`

## Step 3: Update Railway with Vercel URL

After Vercel deployment:

1. Go back to Railway
2. Update the `FRONTEND_URL` environment variable with your actual Vercel URL
3. Railway will automatically redeploy

## Environment Variables Summary

### Railway (Backend)

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string (auto-set by Railway PostgreSQL) |
| `FRONTEND_URL` | Yes | Exact Vercel frontend origin (e.g., `https://your-app.vercel.app`) |
| `JWT_SECRET` | Yes | Long random string for signing authentication tokens |
| `OPENAI_API_KEY` | Yes | OpenAI API key for AI Game Master feature |
| `NODE_ENV` | Yes | Set to `production` |

### Vercel (Frontend)

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_API_URL` | Yes | Exact Railway backend origin (e.g., `https://your-app.up.railway.app`) |

## Build Commands Reference

| Command | Description |
|---------|-------------|
| `npm run build:frontend` | Builds only the React frontend (for Vercel) using `vite build` |
| `npm run build:backend` | Builds only the Express backend (for Railway) using esbuild |
| `npm run start:backend` | Starts the production backend server |

## Railway Configuration Notes

- `nixpacks.toml` tells Railway to use Node.js 20 and run `npm run build:backend` (backend only)
- `railway.json` configures the build and start commands and health check path
- The backend uses `bcryptjs` (pure JavaScript) so no native compilation tools are needed on Railway

## Database Migrations

Before first deployment, run database migrations:

```bash
npm run db:push
```

This syncs your Drizzle schema to the PostgreSQL database.

## Cookie & CORS Configuration

Auth cookies are configured as follows for cross-origin (Vercel ↔ Railway) requests to work:

- `sameSite: "none"` — required so browsers send the cookie on cross-origin requests
- `secure: true` — required when `sameSite: "none"` (cookies are only sent over HTTPS)
- `httpOnly: true` — prevents JavaScript access to the cookie

The CORS middleware on the backend uses an exact-match allowlist. Only the origin specified in `FRONTEND_URL` (plus localhost URLs for local development) will receive `Access-Control-Allow-Origin` headers.

## Troubleshooting

### CORS Errors
- Ensure `FRONTEND_URL` is set to the exact Vercel origin in Railway (no trailing slash)
- If using a custom domain on Vercel, update `FRONTEND_URL` to match the custom domain

### API Connection Issues
- Verify `VITE_API_URL` is set in Vercel before deploying (include the full URL with `https://`)
- Check Railway logs for backend errors
- Ensure `VITE_API_URL` has no trailing slash

### Cookies Not Sent
- Both Vercel and Railway must be served over HTTPS (they are by default)
- Ensure `NODE_ENV=production` is set on Railway so `secure: true` is enforced on cookies

### Database Connection
- Ensure `DATABASE_URL` is set in Railway
- Run `npm run db:push` to create tables

### Build Failures on Railway
- Make sure the Railway project's Root Directory is set to `Legends-Of-Valor`
- The `nixpacks.toml` file handles Node.js installation and the build step automatically

## Local Development

For local development, the app runs as a single server on port 5000:

```bash
npm run dev
```

No environment variables needed for local development - the frontend proxies API requests to the same server.
