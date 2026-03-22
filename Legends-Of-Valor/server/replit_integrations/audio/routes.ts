import type { Express, Request, Response } from "express";

export function registerAudioRoutes(app: Express): void {
  app.post("/api/voice/conversations/:id/messages", async (_req: Request, res: Response) => {
    res.status(503).json({
      error: "Voice input via server is not available. Please use the browser's built-in microphone and Web Speech API for voice input.",
    });
  });

  app.post("/api/voice/conversations/:id/voice-stream", async (_req: Request, res: Response) => {
    res.status(503).json({
      error: "Voice streaming via server is not available. Please use the browser's built-in microphone and Web Speech API for voice input.",
    });
  });
}
