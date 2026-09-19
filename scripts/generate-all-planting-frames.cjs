const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const src = 'C:/Users/razae/.gemini/antigravity/brain/2db0cdf7-5e33-45d3-9033-b0c3d72cdd64/.user_uploaded/media_1789819801760.png';

const targets = [
  path.join(__dirname, '..', 'public', 'art', 'cappy'),
  path.join(__dirname, '..', 'dist', 'vercel', 'art', 'cappy'),
];

const segments = [
  { startX: 21, endX: 123 },
  { startX: 147, endX: 259 },
  { startX: 277, endX: 374 },
  { startX: 395, endX: 488 },
  { startX: 517, endX: 617 },
  { startX: 644, endX: 744 },
  { startX: 771, endX: 869 },
  { startX: 886, endX: 1000 }
];

const CANVAS = 400;
const BASELINE_Y = 360;
const TARGET_STAND_H = 260;
const SOURCE_STAND_H = 90; // Frame 1 walking height
const SCALE = TARGET_STAND_H / SOURCE_STAND_H; // 2.888888...

async function main() {
  const { data, info } = await sharp(src).raw().toBuffer({ resolveWithObject: true });

  console.log(`Extracting and normalizing 8 planting frames (scale: ${SCALE.toFixed(3)}x)...`);

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    let minX = seg.endX, maxX = seg.startX, minY = info.height, maxY = 0;
    for (let y = 0; y < info.height; y++) {
      for (let x = seg.startX; x <= seg.endX; x++) {
        const a = data[(y * info.width + x) * 4 + 3];
        if (a > 20) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    const trimW = maxX - minX + 1;
    const trimH = maxY - minY + 1;

    let targetW = Math.round(trimW * SCALE);
    let targetH = Math.round(trimH * SCALE);

    // Safeguard canvas boundaries
    if (targetH > CANVAS - 15) {
      const adj = (CANVAS - 15) / targetH;
      targetH = CANVAS - 15;
      targetW = Math.round(targetW * adj);
    }
    if (targetW > CANVAS - 15) {
      const adj = (CANVAS - 15) / targetW;
      targetW = CANVAS - 15;
      targetH = Math.round(targetH * adj);
    }

    const resized = await sharp(src)
      .extract({ left: minX, top: minY, width: trimW, height: trimH })
      .resize(targetW, targetH)
      .toBuffer();

    // Center horizontally, anchor feet/ground at BASELINE_Y
    const left = Math.max(0, Math.min(CANVAS - targetW, Math.round((CANVAS - targetW) / 2)));
    const top = Math.max(0, Math.min(CANVAS - targetH, BASELINE_Y - targetH));

    const canvas = await sharp({
      create: {
        width: CANVAS,
        height: CANVAS,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      }
    })
    .composite([{ input: resized, left, top }])
    .png()
    .toBuffer();

    const filename = `plant-${i + 1}.png`;
    for (const t of targets) {
      fs.mkdirSync(t, { recursive: true });
      fs.writeFileSync(path.join(t, filename), canvas);
    }

    console.log(`Saved ${filename}: target size ${targetW}x${targetH} at (${left}, ${top})`);
  }

  console.log('All 8 planting frames successfully generated!');
}

main().catch(console.error);
