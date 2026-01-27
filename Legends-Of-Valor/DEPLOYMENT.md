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
3. Railway will auto-detect the configuration from `railway.json`

### 1.2 Add PostgreSQL Database

1. In your Railway project, click "+ New" and select "Database" → "PostgreSQL"
2. Railway will automatically set the `DATABASE_URL` environment variable

### 1.3 Configure Environment Variables

In Railway's project settings, add:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | (Auto-set by Railway PostgreSQL) |
| `FRONTEND_URL` | Your Vercel frontend URL (e.g., `https://your-app.vercel.app`) |
| `OPENAI_API_KEY` | Your OpenAI API key for AI Game Master |
| `SESSION_SECRET` | A random string for session encryption |

### 1.4 Get your Railway Backend URL

After deployment, note your Railway app URL (e.g., `https://your-app.up.railway.app`)

## Step 2: Deploy Frontend to Vercel

### 2.1 Create a new Vercel project

1. Go to https://vercel.com and create a new project
2. Import this repository from GitHub
3. Vercel will auto-detect the configuration from `vercel.json`

### 2.2 Configure Environment Variables

In Vercel's project settings → Environment Variables, add:

| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | Your Railway backend URL (e.g., `https://your-app.up.railway.app`) |

### 2.3 Deploy

Click "Deploy" and Vercel will build the frontend using `npm run build:frontend`

## Step 3: Update Railway with Vercel URL

After Vercel deployment:

1. Go back to Railway
2. Update the `FRONTEND_URL` environment variable with your actual Vercel URL
3. Railway will automatically redeploy

## Build Commands Reference

| Command | Description |
|---------|-------------|
| `npm run build:frontend` | Builds the React frontend (for Vercel) |
| `npm run build:backend` | Builds the Express backend (for Railway) |
| `npm run start:backend` | Starts the production backend server |

## Database Migrations

Before first deployment, run database migrations:

```bash
npm run db:push
```

This syncs your Drizzle schema to the PostgreSQL database.

## Troubleshooting

### CORS Errors
- Ensure `FRONTEND_URL` is set correctly in Railway
- The backend allows any `.vercel.app` domain by default

### API Connection Issues
- Verify `VITE_API_URL` is set in Vercel (include the full URL with `https://`)
- Check Railway logs for backend errors

### Database Connection
- Ensure `DATABASE_URL` is set in Railway
- Run `npm run db:push` to create tables

## Local Development

For local development, the app runs as a single server on port 5000:

```bash
npm run dev
```

No environment variables needed for local development - the frontend proxies API requests to the same server.
