# P99 Cloud (coming soon)

Same client. Same protocol. Different URL.

The hosted P99 runtime is not live yet. When it is, switching from local to
cloud is a config change:

```bash
# .env
VITE_P99_RUNTIME_URL=wss://runtime.p99lab.com/v1/ws
VITE_P99_API_KEY=pk_live_...
```

```ts
import { VoiceClient } from "@p99labs/voice";

const client = new VoiceClient({
  url: import.meta.env.VITE_P99_RUNTIME_URL,
  apiKey: import.meta.env.VITE_P99_API_KEY,
});
```

> **API keys in the browser:** anything shipped to the browser is visible to
> your users. Keys are fine for prototyping; production apps should mint
> short-lived session tokens from their own backend (the protocol reserves
> `session.start` for this).

## What the hosted tier adds

| Capability | OSS local | P99 cloud / on-prem |
|------------|-----------|---------------------|
| Browser client | ✓ | ✓ |
| Protocol | ✓ | ✓ |
| GPU inference at low p99 latency | your box | managed |
| Autoscale | — | ✓ |
| Fine-tuned private voices | DIY | managed jobs + storage |
| On-prem data residency | DIY | licensed appliance |
| SIP / telephony | — | enterprise |
| SLA + support | — | enterprise |
