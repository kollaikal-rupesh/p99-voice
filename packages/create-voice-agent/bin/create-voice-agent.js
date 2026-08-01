#!/usr/bin/env node
/**
 * npx @p99labs/create-voice-agent my-agent
 *
 * Copies a minimal Vite + TypeScript template wired to @p99labs/voice.
 */

import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const templateDir = join(__dirname, "..", "template");

const name = process.argv[2] || "my-voice-agent";
const target = resolve(process.cwd(), name);

if (existsSync(target)) {
  console.error(`\n  ✗  Directory already exists: ${target}\n`);
  process.exit(1);
}

mkdirSync(target, { recursive: true });
cpSync(templateDir, target, { recursive: true });

// Personalize package.json name
const pkgPath = join(target, "package.json");
const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
pkg.name = name;
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");

console.log(`
  ✓  Created ${name}

  Next:

    cd ${name}
    npm install
    npm run dev          # browser UI on http://localhost:5173

  Runtime (separate terminal):

    # local OSS (when p99-runtime is installed)
    p99-runtime serve --port 8787

    # or point at hosted P99 infra
    export P99_RUNTIME_URL=wss://runtime.p99lab.com/v1/ws
    export P99_API_KEY=pk_live_...

  Docs: https://github.com/kollaikal-rupesh/p99-voice
`);
