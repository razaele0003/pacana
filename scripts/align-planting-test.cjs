const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const src = 'C:/Users/razae/.gemini/antigravity/brain/2db0cdf7-5e33-45d3-9033-b0c3d72cdd64/.user_uploaded/media_1789819801760.png';

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
const SCALE = 260 / 90; // 2.888888...

async function main() {
  const { data, info } = await sharp(src).raw().toBuffer({ resolveWithObject: true });

  const frames = [];
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

    const targetW = Math.round(trimW * SCALE);
    const targetH = Math.round(trimH * SCALE);

    const resized = await sharp(src)
      .extract({ left: minX, top: minY, width: trimW, height: trimH })
      .resize(targetW, targetH)
      .toBuffer();

    // Place on 400x400 canvas
    // For ground baseline: align maxY to BASELINE_Y (360)
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

    frames.push(canvas);
  }

  // Create a horizontal preview filmstrip of all 8 frames
  const filmstrip = await sharp({
    create: {
      width: CANVAS * 8,
      height: CANVAS,
      channels: 4,
      background: { r: 248, g: 246, b: 239, alpha: 1 } // Pacana warm background
    }
  })
  .composite(frames.map((f, i) => ({ input: f, left: i * CANVAS, top: 0 })))
  .png()
  .toFile(path.join(__dirname, '..', '.cache', 'planting-filmstrip.png'));

  console.log('Generated planting-filmstrip.png in .cache');
}

main().catch(console.error);
