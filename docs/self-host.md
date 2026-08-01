# Self-host the runtime

```bash
cd runtime
python -m venv .venv && source .venv/bin/activate
pip install -e .
p99-runtime serve --port 8787
```

Point the client:

```ts
new VoiceClient({ url: "ws://localhost:8787/ws" });
```

## Production notes

- Terminate TLS at a reverse proxy (`wss://`).
- Do not expose an unauthenticated runtime on the public internet.
- For multi-tenant auth, quotas, and autoscaling GPUs, use P99 hosted infra
  instead of reinventing the control plane.

## Next: real models

The stub answers without ML. Swap `handle_turn` in `p99_runtime/server.py`
for your ASR → LLM → TTS (or full-duplex S2S) stack. Keep the JSON/binary
event names so the OSS client does not change.
