// scripts/stamp-sw.mjs
// Replaces the SW_VERSION placeholder in public/sw.js with a unique build
// stamp so the service worker file changes on every deploy. That is what
// makes the browser fire "updatefound" and lets the app show the
// "New version available" popup when a new change is pushed.
//
// Usage:
//   node scripts/stamp-sw.mjs stamp     (run before build via "prebuild")
//   node scripts/stamp-sw.mjs restore   (run after  build via "postbuild")
import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const swPath = join(root, "public", "sw.js");
const mode = process.argv[2] ?? "stamp";
const PLACEHOLDER = 'const SW_VERSION = "__SW_VERSION__";';

function buildVersion() {
  try {
    const sha = execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim();
    return `const SW_VERSION = "v${sha}";`;
  } catch {
    // No git available (e.g. some CI) — fall back to a time-based stamp.
    return `const SW_VERSION = "t${Date.now().toString(36)}";`;
  }
}

const raw = readFileSync(swPath, "utf8");

if (mode === "stamp") {
  const next = raw.includes(PLACEHOLDER)
    ? raw.replace(PLACEHOLDER, buildVersion())
    : raw.replace(/const SW_VERSION = "[^"]*";/, buildVersion());
  writeFileSync(swPath, next);
  console.log("[stamp-sw] stamped public/sw.js");
} else if (mode === "restore") {
  const next = raw.replace(/const SW_VERSION = "[^"]*";/, PLACEHOLDER);
  writeFileSync(swPath, next);
  console.log("[stamp-sw] restored public/sw.js placeholder");
} else {
  console.error(`[stamp-sw] Unknown mode "${mode}" (expected "stamp" or "restore")`);
  process.exit(1);
}
