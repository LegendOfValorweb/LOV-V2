# Deployment Guide

This project uses a split deployment model:

- **Backend** (Express + WebSockets) → [Render](https://render.com)
- **Frontend** (React + Vite SPA) → [Vercel](https://vercel.com)

Render is used for the backend because it supports always-on Node.js servers with persistent WebSocket connections. Vercel is serverless and cannot host a persistent Express server.

---

## 1. Deploy the Backend on Render

### Prerequisites

- A [Render](https://render.com) account
- A PostgreSQL database accessible via a connection string (Render managed Postgres, Neon, Supabase, or any external provider)

### Steps

1. Push this repository to GitHub (or connect your existing GitHub repo to Render).
2. In the Render dashboard, click **New → Blueprint** and select this repository.
   Render will detect `render.yaml` automatically and create the `legends-of-valor-backend` web service.
3. After the service is created, open the service's **Environment** tab and set the following variables:

   | Variable         | Required | Description |
   |------------------|----------|-------------|
   | `DATABASE_URL`   | Yes      | Full PostgreSQL connection string (e.g. `postgresql://user:pass@host/db`) |
   | `JWT_SECRET`     | Yes      | Long random string used to sign JSON Web Tokens |
   | `FRONTEND_URL`   | Yes      | Full Vercel URL of your frontend — exact origin, no trailing slash (e.g. `https://your-app.vercel.app`) — used for CORS |
   | `GOOGLE_API_KEY` | Yes      | Google Generative AI API key (required for AI features) |
   | `NODE_ENV`       | Yes      | Pre-configured to `production` in `render.yaml` — no action needed |

4. Trigger a deploy (or wait for the automatic deploy to complete). Render will run:
   - **Build**: `npm install --include=dev && npm run build:backend`
   - **Start**: `npm run start:backend`
5. Once deployed, note your service's public URL — it will look like:
   `https://legends-of-valor-backend.onrender.com`

### Health Check

Render monitors the service at **`/api/health`**. If the endpoint returns a non-2xx response the service will be restarted. The endpoint is always active and returns:

```json
{ "status": "ok", "timestamp": "..." }
```

---

## 2. Update vercel.json with the Render URL

After completing Step 1, open `vercel.json` and replace the placeholder with your actual Render service URL:

```json
{
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "https://YOUR_RENDER_SERVICE.onrender.com/api/:path*"
    },
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

Replace `YOUR_RENDER_SERVICE` with the subdomain shown in your Render dashboard
(e.g. `legends-of-valor-backend`).

Commit and push this change — Vercel will redeploy the frontend automatically.

---

## 3. Deploy the Frontend on Vercel

### Steps

1. Import this repository into [Vercel](https://vercel.com).
2. In the Vercel project settings, set the **Root Directory** to `Legends-Of-Valor`.
3. Vercel auto-detects the following settings from `vercel.json`:
   - **Install Command**: `npm install`
   - **Build Command**: `npm run build:frontend`
   - **Output Directory**: `dist/public`
4. **No environment variables are required on Vercel.** The API proxy in `vercel.json`
   forwards all `/api/*` requests to Render at the Vercel edge — the frontend never
   needs to know the backend URL directly. `VITE_API_URL` is not needed because the
   rewrite rule handles routing.
5. Click **Deploy**. Your frontend will be available at your Vercel domain.

---

## 4. Cross-link the Two Services

Once both are deployed:

1. On Render, set `FRONTEND_URL` to your Vercel domain (e.g. `https://your-app.vercel.app`).
   This allows CORS requests from the frontend to the backend.
2. Ensure `vercel.json` points to the Render backend URL (done in Step 2 above).

---

## Environment Variable Summary

| Platform | Variable         | Required | Notes |
|----------|------------------|----------|-------|
| Render   | `DATABASE_URL`   | Yes      | Postgres connection string |
| Render   | `JWT_SECRET`     | Yes      | Secret for signing JWTs |
| Render   | `FRONTEND_URL`   | Yes      | Vercel domain — used for CORS (exact origin, no trailing slash) |
| Render   | `GOOGLE_API_KEY` | Yes      | Google AI key for AI Game Master |
| Render   | `NODE_ENV`       | Yes      | Set to `production` (pre-configured in `render.yaml`) |
| Vercel   | _(none)_         | —        | No env vars needed; proxy handles API routing |

---

## Build Commands Reference

| Command                 | Description |
|-------------------------|-------------|
| `npm run build:frontend`| Builds the React SPA (for Vercel) using Vite |
| `npm run build:backend` | Compiles the Express server (for Render) using esbuild |
| `npm run start:backend` | Starts the production backend server |
| `npm run db:push`       | Syncs the Drizzle schema to the PostgreSQL database |

---

## Notes

- **Free-tier cold starts**: Render's free plan spins down idle services after 15 minutes
  of inactivity. The first request after a cold start may take 30–60 seconds.
  Upgrade to a paid plan for always-on behaviour.
- **WebSockets**: Render supports persistent WebSocket connections — the reason it was
  chosen over Vercel (which is serverless and cannot hold open connections).
- **Database migrations**: Run `npm run db:push` locally with `DATABASE_URL` pointing at
  your production database to apply schema changes before or after deployment.

---

## Troubleshooting

### CORS Errors
- Ensure `FRONTEND_URL` on Render is the exact Vercel origin (no trailing slash).
- If you use a custom domain on Vercel, update `FRONTEND_URL` to match.

### API 404s on Vercel
- Verify `vercel.json` has the correct Render URL in the rewrite destination.
- Redeploy Vercel after updating `vercel.json`.

### Cookies Not Sent
- Both Render and Vercel serve over HTTPS by default — no extra action needed.
- Confirm `NODE_ENV=production` is set on Render so cookies use `secure: true`.

### Database Connection Issues
- Verify `DATABASE_URL` is set correctly on Render.
- Run `npm run db:push` to ensure tables exist.

### Build Failures on Render
- Confirm the Render service root is set to `Legends-Of-Valor` if deploying from a
  monorepo, or that your repo root is `Legends-Of-Valor` directly.

---

## Local Development

For local development the app runs as a single server on port 5000:

```bash
npm run dev
```

No environment variables are required for local development — the frontend Vite dev server
proxies API requests to the same local server.
