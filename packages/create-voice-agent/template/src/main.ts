import { VoiceClient } from "@p99labs/voice";

const runtimeUrl =
  import.meta.env.VITE_P99_RUNTIME_URL ?? "ws://localhost:8787/ws";
const apiKey = import.meta.env.VITE_P99_API_KEY as string | undefined;

const stateEl = document.getElementById("state")!;
const logEl = document.getElementById("log")!;
const statsEl = document.getElementById("stats")!;
const connectBtn = document.getElementById("connect") as HTMLButtonElement;
const disconnectBtn = document.getElementById(
  "disconnect",
) as HTMLButtonElement;

function append(role: "user" | "agent", text: string) {
  const line = document.createElement("div");
  line.className = role;
  line.textContent = `${role === "user" ? "You" : "Agent"}: ${text}`;
  logEl.appendChild(line);
  logEl.scrollTop = logEl.scrollHeight;
}

const client = new VoiceClient(
  { url: runtimeUrl, apiKey },
  {
    onState: (s) => {
      stateEl.textContent = s;
    },
    onTranscript: (t) => {
      if (t) append("user", t);
    },
    onAssistantChunk: (t) => {
      if (t) append("agent", t);
    },
    onStats: (s) => {
      const parts = [
        s.perceived_first_audio_ms != null
          ? `perceived ${Math.round(s.perceived_first_audio_ms)}ms`
          : null,
        s.total_turn_ms != null
          ? `turn ${Math.round(s.total_turn_ms)}ms`
          : null,
        s.asr_ms != null ? `asr ${Math.round(s.asr_ms)}ms` : null,
        s.llm_ttft_ms != null ? `ttft ${Math.round(s.llm_ttft_ms)}ms` : null,
      ].filter(Boolean);
      statsEl.textContent = parts.join(" · ");
    },
    onError: (kind, message) => {
      append("agent", `[${kind}] ${message}`);
    },
  },
);

connectBtn.addEventListener("click", async () => {
  connectBtn.disabled = true;
  await client.connect();
  disconnectBtn.disabled = false;
});

disconnectBtn.addEventListener("click", () => {
  client.disconnect();
  connectBtn.disabled = false;
  disconnectBtn.disabled = true;
});
