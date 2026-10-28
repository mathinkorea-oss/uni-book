/**
 * UNITHE 법카노트 — 앱 아이콘 생성 (원본 PNG 기준)
 * node scripts/generate-app-icons.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import pngToIco from "png-to-ico";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const SOURCE = path.join(
  root,
  "public",
  "brand",
  "unithe-logo-source.png",
);

/** 로고가 차지할 캔버스 비율 (안전 여백) */
const LOGO_FILL = 0.86;

async function buildSquareIcon(trimmed, size) {
  const meta = await sharp(trimmed).metadata();
  const w = meta.width ?? 1;
  const h = meta.height ?? 1;
  const target = Math.round(size * LOGO_FILL);
  const scale = Math.min(target / w, target / h);
  const nw = Math.round(w * scale);
  const nh = Math.round(h * scale);

  const resized = await sharp(trimmed)
    .resize(nw, nh, { fit: "fill", kernel: sharp.kernel.lanczos3 })
    .png()
    .toBuffer();

  return sharp({
    create: {
      width: size,
      height: size,
      channels: 3,
      background: { r: 255, g: 255, b: 255 },
    },
  })
    .composite([{ input: resized, gravity: "center" }])
    .png()
    .toBuffer();
}

async function main() {
  if (!fs.existsSync(SOURCE)) {
    console.error("원본 없음:", SOURCE);
    process.exit(1);
  }

  const sourceMeta = await sharp(SOURCE).metadata();
  console.log(
    "원본:",
    `${sourceMeta.width}×${sourceMeta.height}`,
    sourceMeta.format,
  );

  const trimmed = await sharp(SOURCE)
    .trim({ threshold: 12, background: "#ffffff" })
    .png()
    .toBuffer();
  const trimMeta = await sharp(trimmed).metadata();
  console.log("트림 후:", `${trimMeta.width}×${trimMeta.height}`);

  const outDir = path.join(root, "public", "icons");
  fs.mkdirSync(outDir, { recursive: true });

  const sizes = [
    { name: "icon-32.png", size: 32 },
    { name: "icon-192.png", size: 192 },
    { name: "icon-512.png", size: 512 },
    { name: "apple-touch-icon.png", size: 180 },
  ];

  const icon32 = await buildSquareIcon(trimmed, 32);
  const icon16 = await buildSquareIcon(trimmed, 16);
  fs.writeFileSync(path.join(outDir, "icon-32.png"), icon32);

  const ico = await pngToIco([icon16, icon32]);
  fs.writeFileSync(path.join(root, "app", "favicon.ico"), ico);
  console.log(" wrote app/favicon.ico");

  const apple = await buildSquareIcon(trimmed, 180);
  fs.writeFileSync(path.join(outDir, "apple-touch-icon.png"), apple);
  console.log(" wrote", path.join(outDir, "apple-touch-icon.png"), "180×180");

  for (const { name, size } of sizes.filter((s) => s.name !== "icon-32.png" && s.name !== "apple-touch-icon.png")) {
    const buf = await buildSquareIcon(trimmed, size);
    const dest = path.join(outDir, name);
    fs.writeFileSync(dest, buf);
    console.log(" wrote", dest, size + "×" + size);
  }

  fs.writeFileSync(path.join(root, "app", "apple-icon.png"), apple);
  console.log(" wrote app/apple-icon.png");

  const icon192 = fs.readFileSync(path.join(outDir, "icon-192.png"));
  fs.writeFileSync(path.join(root, "app", "icon.png"), icon192);
  console.log(" wrote app/icon.png (192×192)");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
