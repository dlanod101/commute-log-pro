// scripts/generate-pwa-icons.mjs
// One-off generator for the PWA icon set in public/.
//
// Why: the install prompt and the home-screen icon need SQUARE PNGs with the
// sizes declared in public/manifest.webmanifest. `public/logo.png` is
// 548x455 (non-square, transparent), which Chrome rejects for `purpose:
// "maskable"` and renders letterboxed everywhere else.
//
// Usage: node scripts/generate-pwa-icons.mjs
// Requires the `sharp` binary that is already present in node_modules
// (transitive dependency). The output PNGs are committed to public/, so this
// script never runs as part of `pnpm build`.
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC = join(root, "public");
const SOURCE = join(PUBLIC, "logo.png");

/** Brand navy — matches manifest theme_color / background_color. */
const BRAND = { r: 0x1e, g: 0x3a, b: 0x5f, alpha: 1 };

/**
 * Composite the source mark, trimmed and centred, on a solid brand square.
 *
 * `logoScale` is the share of the canvas the mark may occupy. Maskable icons
 * keep the mark inside the 80% "safe zone" circle so launcher masks can never
 * crop it.
 */
async function build({ size, logoScale, out, opaque }) {
  const inner = Math.round(size * logoScale);
  const mark = await sharp(SOURCE)
    // Drop the fully-transparent border so the mark is centred predictably.
    .trim({ threshold: 1 })
    .resize({ width: inner, height: inner, fit: "inside", withoutEnlargement: false })
    .png()
    .toBuffer();

  let pipeline = sharp({
    create: { width: size, height: size, channels: 4, background: BRAND },
  }).composite([{ input: mark, gravity: "center" }]);

  // iOS composites transparent apple-touch-icons on black, so keep it opaque.
  if (opaque) pipeline = pipeline.flatten({ background: BRAND });

  await pipeline.png({ compressionLevel: 9 }).toFile(join(PUBLIC, out));
  console.log(`[pwa-icons] ${out} (${size}x${size}, mark ${inner}px)`);
}

mkdirSync(PUBLIC, { recursive: true });

await build({ size: 192, logoScale: 0.72, out: "pwa-192x192.png" });
await build({ size: 512, logoScale: 0.72, out: "pwa-512x512.png" });
await build({ size: 512, logoScale: 0.56, out: "maskable-512x512.png" });
await build({ size: 180, logoScale: 0.72, out: "apple-touch-icon.png", opaque: true });
