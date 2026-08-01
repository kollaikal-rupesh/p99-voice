#!/usr/bin/env node
/**
 * npx @p99labs/create-voice-agent my-agent
 *
 * Copies a minimal Vite + TypeScript template wired to @p99labs/voice.
 */

import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
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

// npm strips .gitignore from published packages, so the template ships
// _gitignore and we rename it here.
const gitignorePath = join(target, "_gitignore");
if (existsSync(gitignorePath)) {
  renameSync(gitignorePath, join(target, ".gitignore"));
}

console.log(`
  ✓  Created ${name}

  Next:

    cd ${name}
    npm install
    npm run dev          # browser UI on http://localhost:5173

  Runtime (separate terminal):

    # local OSS runtime — see the repo's /runtime for install
    p99-runtime serve --port 8787

    # hosted P99 cloud is coming soon — when live, set
    # VITE_P99_RUNTIME_URL + VITE_P99_API_KEY in .env (see .env.example)

  Docs: https://github.com/kollaikal-rupesh/p99-voice
`);
