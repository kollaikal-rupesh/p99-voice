# Self-host the runtime

```bash
python -m venv .venv && source .venv/bin/activate
pip install p99-runtime
p99-runtime serve --port 8787
```

(Or from a repo checkout: `pip install -e ./runtime`.)

Point the client:

```ts
new VoiceClient({ url: "ws://localhost:8787/ws" });
```

## Production notes

- The server binds `127.0.0.1` by default. Pass `--host 0.0.0.0` only
  behind a reverse proxy with TLS and auth.
- Terminate TLS at a reverse proxy (`wss://`).
- Do not expose an unauthenticated runtime on the public internet.
- For multi-tenant auth, quotas, and autoscaling GPUs, P99's hosted runtime
  (coming soon) will handle the control plane for you.

## Next: real models

The stub answers without ML. Swap `handle_turn` in `p99_runtime/server.py`
for your ASR → LLM → TTS (or full-duplex S2S) stack. Keep the JSON/binary
event names so the OSS client does not change.
