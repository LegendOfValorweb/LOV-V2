import { Buffer } from "node:buffer";
import { spawn } from "child_process";

/**
 * Convert WebM audio buffer to WAV format using ffmpeg.
 * Browser MediaRecorder outputs WebM/opus which must be converted to WAV for audio APIs.
 */
export function convertWebmToWav(webmBuffer: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn("ffmpeg", [
      "-i", "pipe:0",
      "-f", "wav",
      "-ar", "16000",
      "-ac", "1",
      "-acodec", "pcm_s16le",
      "pipe:1"
    ]);

    const chunks: Buffer[] = [];

    ffmpeg.stdout.on("data", (chunk) => chunks.push(chunk));
    ffmpeg.stderr.on("data", () => {});
    ffmpeg.on("close", (code) => {
      if (code === 0) {
        resolve(Buffer.concat(chunks));
      } else {
        reject(new Error(`ffmpeg exited with code ${code}`));
      }
    });
    ffmpeg.on("error", reject);

    ffmpeg.stdin.write(webmBuffer);
    ffmpeg.stdin.end();
  });
}

/**
 * Voice Chat: Disabled — OpenAI audio models removed.
 * Use the browser's Web Speech API for voice input instead.
 */
export async function voiceChat(
  _audioBuffer: Buffer,
  _voice?: string,
  _inputFormat?: string,
  _outputFormat?: string
): Promise<{ transcript: string; audioResponse: Buffer }> {
  throw new Error("Voice chat via OpenAI is not available. Use the browser Web Speech API.");
}

/**
 * Streaming Voice Chat: Disabled — OpenAI audio models removed.
 */
export async function voiceChatStream(
  _audioBuffer: Buffer,
  _voice?: string,
  _inputFormat?: string
): Promise<AsyncIterable<{ type: "transcript" | "audio"; data: string }>> {
  throw new Error("Voice chat streaming via OpenAI is not available. Use the browser Web Speech API.");
}

/**
 * Text-to-Speech: Disabled — OpenAI audio models removed.
 * The AI chat page uses the browser's built-in SpeechSynthesis API instead.
 */
export async function textToSpeech(
  _text: string,
  _voice?: string,
  _format?: string
): Promise<Buffer> {
  throw new Error("Server-side TTS via OpenAI is not available. Use the browser SpeechSynthesis API.");
}

/**
 * Streaming Text-to-Speech: Disabled — OpenAI audio models removed.
 */
export async function textToSpeechStream(
  _text: string,
  _voice?: string
): Promise<AsyncIterable<string>> {
  throw new Error("Server-side TTS streaming via OpenAI is not available. Use the browser SpeechSynthesis API.");
}

/**
 * Speech-to-Text: Disabled — OpenAI Whisper removed.
 * Use the browser's built-in SpeechRecognition API for voice input.
 */
export async function speechToText(
  _audioBuffer: Buffer,
  _format?: string
): Promise<string> {
  throw new Error("Server-side speech-to-text via OpenAI is not available. Use the browser SpeechRecognition API.");
}

/**
 * Streaming Speech-to-Text: Disabled — OpenAI Whisper removed.
 */
export async function speechToTextStream(
  _audioBuffer: Buffer,
  _format?: string
): Promise<AsyncIterable<string>> {
  throw new Error("Server-side speech-to-text streaming via OpenAI is not available. Use the browser SpeechRecognition API.");
}

// ============================================================
// Sentence Parser - Multilingual using Intl.Segmenter
// ============================================================

/**
 * Extracts complete sentences from streaming text using Intl.Segmenter.
 * Supports multilingual text (handles CJK, Arabic, etc. properly).
 */
export class SentenceParser {
  private buffer = "";
  private seq = 0;
  private segmenter: Intl.Segmenter;

  constructor(locale = "en") {
    this.segmenter = new Intl.Segmenter(locale, { granularity: "sentence" });
  }

  feed(token: string): Array<{ seq: number; text: string }> {
    this.buffer += token;
    const sentences: Array<{ seq: number; text: string }> = [];

    const segments = Array.from(this.segmenter.segment(this.buffer));

    for (let i = 0; i < segments.length - 1; i++) {
      const text = segments[i].segment.trim();
      if (text) {
        sentences.push({ seq: this.seq++, text });
      }
    }

    if (segments.length > 0) {
      this.buffer = segments[segments.length - 1].segment;
    }

    return sentences;
  }

  flush(): { seq: number; text: string } | null {
    const text = this.buffer.trim();
    this.buffer = "";
    return text ? { seq: this.seq++, text } : null;
  }

  reset() {
    this.buffer = "";
    this.seq = 0;
  }
}

export interface VoiceChatStreamEvent {
  type: "user_transcript" | "sentence" | "audio" | "transcript" | "done" | "error";
  seq?: number;
  data?: string;
  text?: string;
  error?: string;
}

/**
 * Voice chat using separate text model and TTS: Disabled — OpenAI removed.
 */
export async function* voiceChatWithTextModel(
  _audioBuffer: Buffer,
  _options: Record<string, unknown> = {}
): AsyncGenerator<VoiceChatStreamEvent> {
  yield { type: "error", error: "Voice chat with text model is not available. OpenAI has been removed." };
  yield { type: "done" };
}
