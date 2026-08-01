/**
 * VoiceClient — browser WebSocket client for the P99 voice runtime.
 *
 * Handles mic capture + VAD, barge-in with soft fade, streaming PCM playback,
 * reconnect, and idle re-engagement. Talks the open P99 protocol so the same
 * client works against local OSS runtime or paid hosted infra.
 */

import { MicVAD } from "@ricky0123/vad-web";
import type {
  ErrorKind,
  TurnStats,
  VoiceClientOptions,
  VoiceState,
} from "@p99labs/protocol";
import { TTS_SAMPLE_RATE } from "@p99labs/protocol";

export type { VoiceState, TurnStats, ErrorKind, VoiceClientOptions };

export interface VoiceEvents {
  onState?: (s: VoiceState) => void;
  onTranscript?: (text: string) => void;
  onAssistantChunk?: (text: string) => void;
  onAssistantTurnStart?: () => void;
  onPerceivedLatency?: (ms: number) => void;
  onStats?: (s: TurnStats) => void;
  onError?: (kind: ErrorKind, message: string) => void;
  onMuted?: (muted: boolean) => void;
  onReady?: () => void;
}

const RECONNECT_DELAYS_MS = [500, 1500, 4000];
const IDLE_REENGAGE_MS = 10_000;
const MAX_PROACTIVE_STREAK = 2;
const BARGEIN_CONFIRM_MS = 350;

export class VoiceClient {
  private ws: WebSocket | null = null;
  private vad: MicVAD | null = null;
  private audioCtx: AudioContext | null = null;
  private nextPlayAt = 0;
  private activeSources: Array<{
    source: AudioBufferSourceNode;
    gain: GainNode;
  }> = [];
  private static readonly FADE_MS = 80;
  private state: VoiceState = "idle";
  private endUtteranceSentAt = 0;
  private firstBinaryAt: number | null = null;
  private speaking = false;
  private muted = false;
  private intentionalClose = false;
  private reconnectAttempt = 0;
  private droppingInterruptedAudio = false;
  private inGreeting = false;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private proactiveStreak = 0;
  private bargeInTimer: ReturnType<typeof setTimeout> | null = null;
  private confirmingBargeIn = false;
  private bargeInCommitted = false;
  private voice: string | null;
  private readonly url: string;
  private readonly apiKey?: string;
  private readonly vadAssetPath: string;
  private readonly events: VoiceEvents;

  constructor(options: VoiceClientOptions, events: VoiceEvents = {}) {
    this.url = options.url;
    this.apiKey = options.apiKey;
    this.voice = options.voice ?? null;
    this.vadAssetPath = options.vadAssetPath ?? "/voice/";
    this.events = events;
  }

  getState(): VoiceState {
    return this.state;
  }

  async connect(): Promise<void> {
    if (this.ws) return;
    this.intentionalClose = false;
    this.reconnectAttempt = 0;
    await this._connectOnce();
  }

  private async _connectOnce(): Promise<void> {
    this.setState(this.reconnectAttempt > 0 ? "reconnecting" : "connecting");

    if (!this.audioCtx || this.audioCtx.state === "closed") {
      this.audioCtx = new AudioContext({ sampleRate: TTS_SAMPLE_RATE });
    }
    if (this.audioCtx.state === "suspended") {
      await this.audioCtx.resume();
    }

    if (!this.vad) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            channelCount: 1,
          },
        });
        this.vad = await MicVAD.new({
          baseAssetPath: this.vadAssetPath,
          onnxWASMBasePath: this.vadAssetPath,
          stream,
          positiveSpeechThreshold: 0.45,
          negativeSpeechThreshold: 0.35,
          minSpeechFrames: 4,
          preSpeechPadFrames: 6,
          redemptionFrames: 8,
          onSpeechStart: () => this.onSpeechStart(),
          onSpeechEnd: (audio) => this.onSpeechEnd(audio),
          onVADMisfire: () => this.onVADMisfire(),
        });
      } catch (e: unknown) {
        this.events.onError?.("mic", this.formatMicError(e));
        this.audioCtx?.close();
        this.audioCtx = null;
        this.setState("idle");
        return;
      }
    }

    const params = new URLSearchParams();
    if (this.voice) params.set("voice", this.voice);
    if (this.apiKey) params.set("api_key", this.apiKey);
    const qs = params.toString();
    const url = qs
      ? `${this.url}${this.url.includes("?") ? "&" : "?"}${qs}`
      : this.url;

    this.ws = new WebSocket(url);
    this.ws.binaryType = "arraybuffer";

    this.ws.addEventListener("open", () => {
      this.reconnectAttempt = 0;
      this.inGreeting = true;
      setTimeout(() => {
        this.inGreeting = false;
      }, 15_000);
      this.setState("listening");
      if (this.voice) this.sendJson({ type: "set_voice", voice: this.voice });
      this.vad?.start();
    });
    this.ws.addEventListener("message", (e) => this.handleMessage(e));
    this.ws.addEventListener("close", () => {
      this.ws = null;
      this.stopPlayback();
      if (this.intentionalClose) {
        this.cleanup();
        this.setState("idle");
        return;
      }
      void this._maybeReconnect();
    });
    this.ws.addEventListener("error", () => {
      if (this.reconnectAttempt === 0) {
        this.events.onError?.(
          "connection",
          `couldn't reach the runtime at ${this.url}. Start local runtime with \`p99-runtime serve\` or set P99_RUNTIME_URL.`,
        );
      }
    });
  }

  private async _maybeReconnect(): Promise<void> {
    if (this.reconnectAttempt >= RECONNECT_DELAYS_MS.length) {
      this.events.onError?.(
        "connection",
        "Lost connection after 3 retries. Restart the runtime and reconnect.",
      );
      this.cleanup();
      this.setState("idle");
      return;
    }
    const delay = RECONNECT_DELAYS_MS[this.reconnectAttempt]!;
    this.reconnectAttempt += 1;
    this.setState("reconnecting");
    await new Promise((r) => setTimeout(r, delay));
    if (this.intentionalClose) return;
    await this._connectOnce();
  }

  disconnect(): void {
    this.intentionalClose = true;
    this.cleanup();
  }

  reset(): void {
    this.stopPlayback();
    this.sendJson({ type: "reset" });
  }

  setVoice(name: string): void {
    this.voice = name;
    this.sendJson({ type: "set_voice", voice: name });
  }

  setMuted(muted: boolean): void {
    if (this.muted === muted) return;
    this.muted = muted;
    if (muted) {
      this.vad?.pause();
    } else if (this.ws?.readyState === WebSocket.OPEN) {
      this.vad?.start();
    }
    this.events.onMuted?.(muted);
  }

  isMuted(): boolean {
    return this.muted;
  }

  private cleanup(): void {
    this.clearIdle();
    if (this.bargeInTimer !== null) {
      clearTimeout(this.bargeInTimer);
      this.bargeInTimer = null;
    }
    this.confirmingBargeIn = false;
    this.bargeInCommitted = false;
    this.vad?.pause();
    this.vad?.destroy();
    this.vad = null;
    if (this.ws) {
      try {
        this.ws.close();
      } catch {
        /* ignore */
      }
      this.ws = null;
    }
    this.stopPlayback();
    this.audioCtx?.close();
    this.audioCtx = null;
  }

  private setState(s: VoiceState): void {
    this.state = s;
    this.events.onState?.(s);
  }

  private onSpeechStart(): void {
    if (this.muted) return;
    this.clearIdle();
    if (this.inGreeting) return;
    const hasActivePlayback = this.activeSources.length > 0 || this.speaking;
    if (hasActivePlayback) {
      if (this.bargeInTimer === null && !this.confirmingBargeIn) {
        this.confirmingBargeIn = true;
        this.bargeInTimer = setTimeout(
          () => this.commitBargeIn(),
          BARGEIN_CONFIRM_MS,
        );
      }
      return;
    }
    this.setState("listening");
  }

  private commitBargeIn(): void {
    this.bargeInTimer = null;
    this.confirmingBargeIn = false;
    this.bargeInCommitted = true;
    this.sendJson({ type: "interrupt" });
    this.stopPlayback();
    this.droppingInterruptedAudio = true;
    this.speaking = false;
    this.setState("listening");
  }

  private onVADMisfire(): void {
    if (this.bargeInTimer !== null) {
      clearTimeout(this.bargeInTimer);
      this.bargeInTimer = null;
    }
    this.confirmingBargeIn = false;
  }

  private onSpeechEnd(audio: Float32Array): void {
    if (this.muted) return;
    if (this.inGreeting) {
      this.confirmingBargeIn = false;
      if (this.bargeInTimer !== null) {
        clearTimeout(this.bargeInTimer);
        this.bargeInTimer = null;
      }
      return;
    }

    const wasConfirmingUncommitted =
      this.confirmingBargeIn && !this.bargeInCommitted;
    if (this.bargeInTimer !== null) {
      clearTimeout(this.bargeInTimer);
      this.bargeInTimer = null;
    }
    this.confirmingBargeIn = false;
    const committed = this.bargeInCommitted;
    this.bargeInCommitted = false;
    if (wasConfirmingUncommitted && !committed) return;

    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const int16 = new Int16Array(audio.length);
    for (let i = 0; i < audio.length; i++) {
      const v = Math.max(-1, Math.min(1, audio[i]!));
      int16[i] = v < 0 ? v * 0x8000 : v * 0x7fff;
    }

    const CHUNK_SAMPLES = 16_384;
    for (let i = 0; i < int16.length; i += CHUNK_SAMPLES) {
      const slice = int16.subarray(
        i,
        Math.min(i + CHUNK_SAMPLES, int16.length),
      );
      this.ws.send(
        slice.buffer.slice(
          slice.byteOffset,
          slice.byteOffset + slice.byteLength,
        ),
      );
    }
    this.endUtteranceSentAt = performance.now();
    this.firstBinaryAt = null;
    this.proactiveStreak = 0;
    this.clearIdle();
    this.sendJson({ type: "end_utterance" });
    this.setState("thinking");
  }

  private sendJson(obj: unknown): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(obj));
    }
  }

  private clearIdle(): void {
    if (this.idleTimer !== null) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
  }

  private scheduleIdle(): void {
    this.clearIdle();
    if (this.muted) return;
    if (this.proactiveStreak >= MAX_PROACTIVE_STREAK) return;
    this.idleTimer = setTimeout(() => this.fireProactive(), IDLE_REENGAGE_MS);
  }

  private fireProactive(): void {
    this.idleTimer = null;
    if (this.muted) return;
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    if (this.speaking || this.activeSources.length > 0) return;
    if (this.proactiveStreak >= MAX_PROACTIVE_STREAK) return;
    this.proactiveStreak += 1;
    this.sendJson({ type: "proactive" });
  }

  private handleMessage(e: MessageEvent): void {
    if (typeof e.data === "string") {
      try {
        const msg = JSON.parse(e.data) as Record<string, unknown>;
        this.handleControl(msg);
      } catch {
        /* ignore */
      }
    } else {
      if (this.droppingInterruptedAudio) return;
      if (this.firstBinaryAt === null && this.endUtteranceSentAt > 0) {
        this.firstBinaryAt = performance.now();
        this.events.onPerceivedLatency?.(
          this.firstBinaryAt - this.endUtteranceSentAt,
        );
      }
      this.playPcmChunk(e.data as ArrayBuffer);
    }
  }

  private handleControl(msg: Record<string, unknown>): void {
    switch (msg.type) {
      case "ready":
        this.events.onReady?.();
        break;
      case "transcript_final":
        this.droppingInterruptedAudio = false;
        this.events.onTranscript?.((msg.text as string) || "");
        break;
      case "thinking":
        this.clearIdle();
        this.setState("thinking");
        break;
      case "proactive":
        this.clearIdle();
        this.events.onAssistantTurnStart?.();
        break;
      case "speaking_start":
        this.droppingInterruptedAudio = false;
        this.clearIdle();
        this.speaking = true;
        this.setState("speaking");
        this.events.onAssistantTurnStart?.();
        break;
      case "assistant_text_chunk":
        if (msg.text) this.events.onAssistantChunk?.(msg.text as string);
        break;
      case "first_audio":
        break;
      case "speaking_end":
        this.speaking = false;
        if (this.inGreeting) {
          const remainingMs = this.audioCtx
            ? Math.max(0, (this.nextPlayAt - this.audioCtx.currentTime) * 1000)
            : 0;
          setTimeout(() => {
            this.inGreeting = false;
          }, remainingMs + 400);
        }
        this.setState("listening");
        this.scheduleIdle();
        break;
      case "stats": {
        const perceived =
          this.firstBinaryAt !== null && this.endUtteranceSentAt > 0
            ? Math.round(this.firstBinaryAt - this.endUtteranceSentAt)
            : null;
        this.events.onStats?.({
          asr_ms: (msg.asr_ms as number) ?? null,
          llm_ttft_ms: (msg.llm_ttft_ms as number) ?? null,
          llm_full_ms: (msg.llm_full_ms as number) ?? null,
          tts_first_ms: (msg.tts_first_ms as number) ?? null,
          real_first_audio_ms: (msg.real_first_audio_ms as number) ?? null,
          perceived_first_audio_ms: perceived,
          total_turn_ms: (msg.total_turn_ms as number) ?? null,
          history_turns: (msg.history_turns as number) ?? null,
        });
        this.endUtteranceSentAt = 0;
        this.firstBinaryAt = null;
        break;
      }
      case "reset_ok":
        break;
      case "error":
        this.events.onError?.(
          "turn",
          (msg.message as string) || "server error",
        );
        break;
    }
  }

  private playPcmChunk(buf: ArrayBuffer): void {
    if (!this.audioCtx) return;
    const int16 = new Int16Array(buf);
    const float = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) float[i] = int16[i]! / 32768;
    const audioBuffer = this.audioCtx.createBuffer(
      1,
      float.length,
      TTS_SAMPLE_RATE,
    );
    audioBuffer.getChannelData(0).set(float);
    const src = this.audioCtx.createBufferSource();
    src.buffer = audioBuffer;
    const gain = this.audioCtx.createGain();
    gain.gain.value = 1;
    src.connect(gain);
    gain.connect(this.audioCtx.destination);
    const now = this.audioCtx.currentTime;
    const startAt = Math.max(now + 0.02, this.nextPlayAt);
    src.start(startAt);
    this.nextPlayAt = startAt + audioBuffer.duration;
    const unit = { source: src, gain };
    src.addEventListener("ended", () => {
      this.activeSources = this.activeSources.filter((u) => u !== unit);
    });
    this.activeSources.push(unit);
  }

  private stopPlayback(): void {
    if (!this.audioCtx) {
      this.activeSources = [];
      this.nextPlayAt = 0;
      return;
    }
    const now = this.audioCtx.currentTime;
    const fadeS = VoiceClient.FADE_MS / 1000;
    for (const { source, gain } of this.activeSources) {
      try {
        gain.gain.cancelScheduledValues(now);
        gain.gain.setValueAtTime(gain.gain.value, now);
        gain.gain.linearRampToValueAtTime(0.0001, now + fadeS);
        source.stop(now + fadeS);
      } catch {
        try {
          source.stop();
        } catch {
          /* ignore */
        }
      }
    }
    this.activeSources = [];
    this.nextPlayAt = 0;
  }

  private formatMicError(e: unknown): string {
    const err = e as { name?: string; message?: string };
    const name = err?.name || "";
    if (name === "NotReadableError") {
      return "Mic is in use by another app. Close other apps using the microphone and try again.";
    }
    if (name === "NotAllowedError") {
      return "Mic permission denied. Allow it in the browser address bar and try again.";
    }
    if (name === "NotFoundError") {
      return "No microphone found. Plug one in or select a device in system settings.";
    }
    return `mic setup failed: ${err?.message || String(e)}`;
  }
}
