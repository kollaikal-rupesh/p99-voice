import { defineConfig } from "vite";
import { viteStaticCopy } from "vite-plugin-static-copy";

// Serve Silero VAD models + onnxruntime WASM at /voice/ (the client's
// default `vadAssetPath`). Copied from node_modules on dev and build.
const flat = { stripBase: true as const };

export default defineConfig({
  server: {
    port: 5173,
  },
  plugins: [
    viteStaticCopy({
      targets: [
        {
          src: "node_modules/@ricky0123/vad-web/dist/*.onnx",
          dest: "voice",
          rename: flat,
        },
        {
          src: "node_modules/@ricky0123/vad-web/dist/vad.worklet.bundle.min.js",
          dest: "voice",
          rename: flat,
        },
        {
          src: "node_modules/onnxruntime-web/dist/*.wasm",
          dest: "voice",
          rename: flat,
        },
        {
          src: "node_modules/onnxruntime-web/dist/*.worker.js",
          dest: "voice",
          rename: flat,
        },
      ],
    }),
  ],
});
