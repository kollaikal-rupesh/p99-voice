# P99 Voice Protocol

Stable contract between `@p99labs/voice` (client) and any runtime
(`p99-runtime` locally, or `runtime.p99lab.com` hosted).

**Transport:** WebSocket  
**Binary:** raw PCM int16 little-endian mono  
**Text:** JSON objects with a `type` field

| Direction | Sample rate |
|-----------|-------------|
| Client → server (mic) | 16 kHz |
| Server → client (TTS / S2S) | 24 kHz |

---

## Client → server

| Type | Payload | When |
|------|---------|------|
| binary PCM | int16 @ 16 kHz | After VAD end-of-speech, chunked |
| `end_utterance` | `{}` | User finished speaking |
| `interrupt` | `{}` | Barge-in confirmed |
| `reset` | `{}` | Clear history / cancel |
| `set_voice` | `{ voice: string }` | Change TTS voice |
| `proactive` | `{}` | Idle re-engagement (client-initiated) |
| `ping` | `{}` | Keepalive |
| `session.start` | optional config | Reserved for future auth sessions |
| `session.end` | `{}` | Reserved |

Query params on connect:

- `voice` — initial voice id  
- `api_key` — hosted only (ignored by OSS local runtime)

---

## Server → client

| Type | Payload | When |
|------|---------|------|
| `ready` | `{}` | Models warm / session accepted |
| `transcript_final` | `{ text }` | ASR result for the turn |
| `thinking` | `{}` | LLM started |
| `speaking_start` | `{}` | About to stream audio |
| `assistant_text_chunk` | `{ text }` | Incremental assistant text |
| `first_audio` | `{}` | First real TTS frame (optional) |
| binary PCM | int16 @ 24 kHz | Streamed speech |
| `speaking_end` | `{}` | Turn audio complete |
| `stats` | timing fields | Turn telemetry (p99 metric) |
| `proactive` | `{}` | Server-initiated turn |
| `reset_ok` | `{}` | History cleared |
| `error` | `{ message }` | Recoverable / fatal error |

### `stats` fields

```json
{
  "type": "stats",
  "asr_ms": 120,
  "llm_ttft_ms": 76,
  "llm_full_ms": 410,
  "tts_first_ms": 90,
  "real_first_audio_ms": 95,
  "total_turn_ms": 520,
  "history_turns": 4
}
```

The browser client also measures **perceived** first-audio latency from
`end_utterance` → first binary frame (includes filler audio).

---

## HTTP helpers (runtime)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/healthz` | `{ ok: true }` |
| GET | `/config` | sample rates + frame size |
| GET | `/voices` | available voice ids |

---

## Compatibility

Any runtime that implements this protocol is a drop-in backend for
`@p99labs/voice`. That is the open surface. **Hosted GPUs, on-prem
appliances, multi-tenant metering, and SIP are the commercial product.**
