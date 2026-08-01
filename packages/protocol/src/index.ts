/**
 * P99 Voice WebSocket protocol.
 *
 * Binary frames: raw PCM int16 mono.
 *   client → server: 16 kHz mic
 *   server → client: 24 kHz TTS / S2S
 *
 * Text frames: JSON with a `type` field (see below).
 * Same protocol for local OSS runtime and paid P99 cloud.
 */

export const MIC_SAMPLE_RATE = 16_000;
export const TTS_SAMPLE_RATE = 24_000;

/** Client connection / session lifecycle states. */
export type VoiceState =
  | "idle"
  | "connecting"
  | "listening"
  | "thinking"
  | "speaking"
  | "reconnecting";

export type ErrorKind = "mic" | "connection" | "turn" | "unknown";

/** Per-turn latency telemetry (the metric we are named for). */
export interface TurnStats {
  asr_ms: number | null;
  llm_ttft_ms: number | null;
  llm_full_ms: number | null;
  tts_first_ms: number | null;
  real_first_audio_ms: number | null;
  perceived_first_audio_ms: number | null;
  total_turn_ms: number | null;
  history_turns: number | null;
}

// ── Client → Server ────────────────────────────────────────────────────────

export type ClientMessage =
  | { type: "end_utterance" }
  | { type: "interrupt" }
  | { type: "reset" }
  | { type: "set_voice"; voice: string }
  | { type: "proactive" }
  | { type: "ping" }
  | {
      type: "session.start";
      voiceId?: string;
      systemPrompt?: string;
      sampleRate?: number;
    }
  | { type: "session.end" };

// ── Server → Client ────────────────────────────────────────────────────────

export type ServerMessage =
  | { type: "ready" }
  | { type: "transcript_final"; text: string }
  | { type: "thinking" }
  | { type: "proactive" }
  | { type: "speaking_start" }
  | { type: "assistant_text_chunk"; text: string }
  | { type: "first_audio" }
  | { type: "speaking_end" }
  | { type: "reset_ok" }
  | { type: "error"; message: string }
  | ({ type: "stats" } & Partial<TurnStats>);

export interface RuntimeConfig {
  mic_sample_rate: number;
  tts_sample_rate: number;
  frame_ms: number;
}

export interface VoiceClientOptions {
  /** WebSocket URL. Local: ws://localhost:8787/ws — Cloud: wss://runtime.p99lab.com/v1/ws */
  url: string;
  /** Required for hosted P99 runtime; ignored by local OSS runtime. */
  apiKey?: string;
  /** Default TTS / S2S voice id. */
  voice?: string;
  /** Path prefix for VAD ONNX + WASM assets (defaults to /voice/). */
  vadAssetPath?: string;
}
