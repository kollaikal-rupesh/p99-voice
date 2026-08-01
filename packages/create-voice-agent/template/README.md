# My P99 Voice Agent

Scaffolded with `@p99labs/create-voice-agent`.

## Run

```bash
npm install
npm run dev
```

In another terminal, start a runtime that speaks the [P99 protocol](https://github.com/kollaikal-rupesh/p99-voice/blob/main/docs/protocol.md):

```bash
# local
p99-runtime serve --port 8787

# or hosted
export VITE_P99_RUNTIME_URL=wss://runtime.p99lab.com/v1/ws
export VITE_P99_API_KEY=pk_live_...
```

## VAD assets

Copy Silero VAD + onnxruntime WASM into `public/voice/` (paths expected by the client’s `vadAssetPath`, default `/voice/`). See the monorepo docs.
