import type { Express, Request, Response } from "express";

export function registerImageRoutes(app: Express): void {
  app.post("/api/generate-image", async (_req: Request, res: Response) => {
    res.status(503).json({
      error: "Image generation is not available. This feature requires a paid AI image generation service which has been disabled.",
    });
  });
}
