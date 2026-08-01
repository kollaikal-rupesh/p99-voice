import { defineConfig } from "vite";

export default defineConfig({
  server: {
    port: 5173,
  },
  // Serve VAD ONNX/WASM from public/voice when you add assets there.
  // See README — copy from @ricky0123/vad-web dist or onnxruntime-web.
});
