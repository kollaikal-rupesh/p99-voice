# p99-runtime

Local open-source voice runtime for the [P99 protocol](../docs/protocol.md).

Speaks the same WebSocket contract as the hosted P99 runtime, so the browser
client (`@p99labs/voice`) works unchanged.

## Quick start

```bash
cd runtime
pip install -e .
p99-runtime serve --port 8787
```

Stub mode works with **zero models** — useful to verify the client pipeline
(mic → WS → PCM playback). To run real models, replace `handle_turn` in
`p99_runtime/server.py` with your ASR → LLM → TTS (or S2S) stack; keep the
[protocol](../docs/protocol.md) events and the client stays unchanged.

## Endpoints

| Path | Description |
|------|-------------|
| `GET /healthz` | Liveness |
| `GET /config` | Mic/TTS sample rates for the client |
| `WS /ws` | Voice session (JSON control + binary PCM) |

The server binds `127.0.0.1` by default. Pass `--host 0.0.0.0` only when
you have TLS and auth in front (see [self-host notes](../docs/self-host.md)).

## Tests

```bash
pip install -e '.[dev]'
pytest
```

## Hosted runtime (coming soon)

P99 will offer a managed GPU runtime speaking this same protocol — swap the
URL, add an API key, no client changes. Watch the repo for availability.
