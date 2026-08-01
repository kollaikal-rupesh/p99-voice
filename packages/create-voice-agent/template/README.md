# My P99 Voice Agent

Scaffolded with `@p99labs/create-voice-agent`.

## Run

```bash
npm install
npm run dev
```

In another terminal, start a runtime that speaks the [P99 protocol](https://github.com/kollaikal-rupesh/p99-voice/blob/main/docs/protocol.md):

```bash
p99-runtime serve --port 8787
```

Hosted P99 cloud is coming soon — when it's live, point at it by setting
`VITE_P99_RUNTIME_URL` and `VITE_P99_API_KEY` in `.env` (see `.env.example`).

## VAD assets

Silero VAD models and onnxruntime WASM are copied automatically from
`node_modules` to `/voice/` on `dev` and `build` (see `vite.config.ts`) —
no manual setup needed.
