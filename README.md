# p99-voice

[![CI](https://github.com/kollaikal-rupesh/p99-voice/actions/workflows/ci.yml/badge.svg)](https://github.com/kollaikal-rupesh/p99-voice/actions/workflows/ci.yml)

**Open-source SDK for real-time browser voice agents.**

Build voice agents without wrestling mic VAD, barge-in, streaming playback,
or turn telemetry. Runs free against a local runtime you control. When you
need GPUs, SLAs, or on-prem data residency, the same client will point at
P99's managed cloud (coming soon).

```bash
npx @p99labs/create-voice-agent my-agent
cd my-agent && npm install && npm run dev
```

```ts
import { VoiceClient } from "@p99labs/voice";

const client = new VoiceClient(
  // local free runtime — or P99 cloud (coming soon) via wss URL + apiKey
  { url: "ws://localhost:8787/ws" },
  {
    onState: console.log,
    onTranscript: (t) => console.log("user:", t),
    onAssistantChunk: (t) => console.log("agent:", t),
    onStats: (s) => console.log("turn:", s.total_turn_ms, "ms"),
  },
);
await client.connect();
```

## Packages

| Package | Role |
|---------|------|
| [`@p99labs/voice`](./packages/voice) | Browser client (VAD, barge-in, PCM, reconnect) |
| [`@p99labs/protocol`](./packages/protocol) | Shared types for the WebSocket contract |
| [`@p99labs/create-voice-agent`](./packages/create-voice-agent) | `npx` scaffold |
| [`p99-runtime`](./runtime) | Local Python runtime (stub → plug your models) |

## Architecture

```
  npm install @p99labs/voice
           │
           ▼
   ┌───────────────┐     same protocol      ┌────────────────────┐
   │  Browser app  │ ◄────────────────────► │  Runtime           │
   │  VoiceClient  │   WS + PCM + JSON      │  local or P99 cloud│
   └───────────────┘                        └────────────────────┘
                                                     │
                              OSS: your GPU / stub   │   Paid: P99 cloud (soon)
                              fine-tune recipes      │   on-prem appliance
```

## Local runtime

```bash
pip install p99-runtime
p99-runtime serve --port 8787
```

Stub mode needs **no models** — useful for client development. Wire real
ASR → LLM → TTS (or S2S) inside the runtime; keep the [protocol](./docs/protocol.md).

## Docs

- [Protocol](./docs/protocol.md)
- [Self-host](./docs/self-host.md)
- [P99 Cloud](./docs/p99-cloud.md)

## What is free vs paid

| | OSS | P99 sells |
|--|-----|-----------|
| Client + protocol + local runtime | ✓ | |
| Hosted low-latency GPU runtime | | ✓ |
| Managed fine-tunes | recipes OSS | jobs + storage paid |
| On-prem for regulated buyers | | ✓ |
| SIP, compliance recording, multi-tenant | | ✓ |

## Develop this monorepo

```bash
npm install
npm run build
npm run typecheck
```

## License

Apache-2.0 — see [LICENSE](./LICENSE).

---

P99 Labs · [p99lab.com](https://p99lab.com)
