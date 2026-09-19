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

async function main() {
  const { data, info } = await sharp(src).raw().toBuffer({ resolveWithObject: true });

  const tempDir = path.join(__dirname, '..', '.cache', 'planting-test');
  fs.mkdirSync(tempDir, { recursive: true });

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

    const outPath = path.join(tempDir, `plant-${i + 1}-raw.png`);
    await sharp(src)
      .extract({ left: minX, top: minY, width: trimW, height: trimH })
      .png()
      .toFile(outPath);

    console.log(`Extracted plant-${i + 1}: ${trimW}x${trimH} (at x=${minX}, y=${minY})`);
  }
}

main().catch(console.error);
