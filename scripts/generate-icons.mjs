import sharp from "sharp";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { mkdirSync, readFileSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const srcSvg = resolve(root, "assets/icon.svg");
const outDir = resolve(root, "public/icons");

mkdirSync(outDir, { recursive: true });

const svg = readFileSync(srcSvg);
const bg = { r: 244, g: 241, b: 234, alpha: 1 }; // --bg

const tasks = [
  // Standard PWA icons (transparent-safe, flattened on theme bg)
  { name: "icon-192.png", size: 192 },
  { name: "icon-512.png", size: 512 },
  // Apple touch icon: iOS ignores transparency and adds its own corners,
  // so render full-bleed on the theme background at 180x180.
  { name: "apple-touch-icon.png", size: 180 },
];

// Maskable icon needs safe padding so platform masks don't crop content.
async function renderMaskable() {
  const size = 512;
  const pad = Math.round(size * 0.12);
  const inner = size - pad * 2;
  const innerPng = await sharp(svg).resize(inner, inner).png().toBuffer();
  await sharp({
    create: { width: size, height: size, channels: 4, background: bg },
  })
    .composite([{ input: innerPng, top: pad, left: pad }])
    .png()
    .toFile(resolve(outDir, "maskable-512.png"));
}

for (const t of tasks) {
  await sharp({
    create: { width: t.size, height: t.size, channels: 4, background: bg },
  })
    .composite([
      { input: await sharp(svg).resize(t.size, t.size).png().toBuffer() },
    ])
    .png()
    .toFile(resolve(outDir, t.name));
  console.log("wrote", t.name);
}

await renderMaskable();
console.log("wrote maskable-512.png");
console.log("Icons generated in", outDir);
