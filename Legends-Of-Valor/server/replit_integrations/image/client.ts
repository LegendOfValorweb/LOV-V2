import { Buffer } from "node:buffer";

/**
 * Generate an image — disabled. OpenAI DALL-E has been removed.
 * Gemini free tier does not support image generation.
 */
export async function generateImageBuffer(
  _prompt: string,
  _size?: string
): Promise<Buffer> {
  throw new Error("Image generation is not available. This feature has been disabled.");
}

/**
 * Edit/combine images — disabled. OpenAI DALL-E has been removed.
 */
export async function editImages(
  _imageFiles: string[],
  _prompt: string,
  _outputPath?: string
): Promise<Buffer> {
  throw new Error("Image editing is not available. This feature has been disabled.");
}
