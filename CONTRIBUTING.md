# Contributing

Thanks for your interest in p99-voice.

## Setup

```bash
npm install
npm run build
npm run typecheck
```

Python runtime:

```bash
cd runtime
pip install -e '.[dev]'
pytest
```

## Layout

| Path | What |
|------|------|
| `packages/protocol` | Shared WebSocket protocol types (TS) |
| `packages/voice` | Browser client |
| `packages/create-voice-agent` | `npx` scaffold + template |
| `runtime` | Local Python runtime (FastAPI) |
| `docs` | Protocol + deployment docs |

## Pull requests

- Keep PRs focused; one change per PR.
- `npm run build && npm run typecheck` and `pytest` (in `runtime/`) must pass.
- Protocol changes (`packages/protocol`, `docs/protocol.md`) are a
  compatibility surface — open an issue to discuss before changing message
  shapes or event names.

## Reporting bugs

Open a GitHub issue with reproduction steps, browser/OS, and runtime logs
where relevant. For security issues, see [SECURITY.md](./SECURITY.md).
