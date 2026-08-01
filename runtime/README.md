# p99-runtime

Local open-source voice runtime for the [P99 protocol](../docs/protocol.md).

Speaks the same WebSocket contract as hosted P99 infra, so the browser client
(`@p99labs/voice`) works unchanged.

## Quick start

```bash
cd runtime
pip install -e .
p99-runtime serve --port 8787
```

Echo / stub mode works with **zero models** — useful to verify the client
pipeline (mic → WS → PCM playback). Wire real ASR/LLM/TTS by setting env
backends (see below).

## Endpoints

| Path | Description |
|------|-------------|
| `GET /healthz` | Liveness |
| `GET /config` | Mic/TTS sample rates for the client |
| `WS /ws` | Voice session (JSON control + binary PCM) |

## Paid upgrade

When local GPU is not enough:

```bash
# same client
P99_RUNTIME_URL=wss://runtime.p99lab.com/v1/ws
P99_API_KEY=pk_live_...
```

You are selling **infra**, not the SDK.
