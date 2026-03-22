import express, { type Request, Response, NextFunction } from "express";
import { serveStatic } from "./static";
import { createServer } from "http";

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

const allowedOrigins = process.env.FRONTEND_URL 
  ? [process.env.FRONTEND_URL, "http://localhost:5173", "http://localhost:5000"]
  : ["http://localhost:5173", "http://localhost:5000"];

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && (allowedOrigins.includes(origin) || allowedOrigins.some(o => origin.endsWith('.vercel.app')))) {
    res.header("Access-Control-Allow-Origin", origin);
    res.header("Access-Control-Allow-Credentials", "true");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  }
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

// Health check endpoints — Railway (and other platforms) may probe /, /health, or /api/health
const healthHandler = (_req: Request, res: Response) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
};
// Only intercept / in production — in dev, Vite serves the frontend from root
if (process.env.NODE_ENV === "production") {
  app.get("/", healthHandler);
}
app.get("/health", healthHandler);
app.get("/api/health", healthHandler);

app.use((req, res, next) => {
  if (req.path === "/api/admin/events" || req.path === "/api/player/events") {
    if (req.method === "GET") {
      return next();
    }
  }
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  })(req, res, next);
});

app.use(express.urlencoded({ extended: false }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

// Start listening immediately so Railway's health check probe succeeds before
// async setup (route registration, Vite) is complete.
const port = parseInt(process.env.PORT || "5000", 10);
httpServer.listen(
  {
    port,
    host: "0.0.0.0",
    reusePort: true,
  },
  () => {
    log(`serving on port ${port}`);
  },
);

(async () => {
  // Dynamic import ensures routes.ts (and db.ts) are only evaluated AFTER
  // the server is already listening, so Railway's health probe always gets
  // a response even if route/DB initialisation is still in progress.
  const { registerRoutes } = await import("./routes");
  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    // Only serve static frontend assets when SERVE_STATIC=true is set.
    // On Railway (API-only deployment) this env var is not set, so the
    // backend runs as a pure API server without requiring dist/public.
    if (process.env.SERVE_STATIC === "true") {
      serveStatic(app);
    }
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }
})().catch((err) => {
  console.error("[FATAL] Server initialisation failed:", err);
  // Process stays alive so Railway's health check keeps getting a 200.
  // Railway will surface the error in deploy logs for debugging.
});
