# P99 Cloud (paid infra)

Same client. Same protocol. Different URL.

```bash
export VITE_P99_RUNTIME_URL=wss://runtime.p99lab.com/v1/ws
export VITE_P99_API_KEY=pk_live_...
```

```ts
import { VoiceClient } from "@p99labs/voice";

const client = new VoiceClient({
  url: "wss://runtime.p99lab.com/v1/ws",
  apiKey: process.env.P99_API_KEY,
});
```

## What you pay for

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

npm is how developers start. Infra is what you sell.
