const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const inDir = path.join(__dirname, '..', 'public', 'art', 'cappy');
const targets = [
  path.join(__dirname, '..', 'public', 'art', 'cappy'),
  path.join(__dirname, '..', 'dist', 'vercel', 'art', 'cappy'),
];

const CANVAS = 400;
const BASELINE_Y = 360;
const TARGET_STAND_H = 260;

// Base scale factors to equalize Cappy body size across all animation sheets:
// In Walking.png, standing height is ~279px. Scale = 260 / 279 = 0.932
// In Eating, Happy, Reading, Stretch, Sleeping: same artist scale in 1536x1024 sheet, so scale = 0.932
// In Focus click.png: Cappy is drawn at 1/2 scale (standing height ~140px). Scale = 260 / 140 = 1.857
function getScale(file) {
  if (file.startsWith('focus')) {
    return TARGET_STAND_H / 140; // 1.857x
  }
  return TARGET_STAND_H / 279; // 0.932x
}

async function normalizeFrame(filename) {
  const p = path.join(inDir, filename);
  if (!fs.existsSync(p)) return;

  const { data, info } = await sharp(p).raw().toBuffer({ resolveWithObject: true });

  // Find tight non-transparent bounds
  let minX = info.width, maxX = 0, minY = info.height, maxY = 0;
  let hasPixels = false;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const alpha = data[(y * info.width + x) * 4 + 3];
      if (alpha > 25) {
        hasPixels = true;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (!hasPixels) return;

  const trimW = maxX - minX + 1;
  const trimH = maxY - minY + 1;

  const scale = getScale(filename);
  let targetW = Math.round(trimW * scale);
  let targetH = Math.round(trimH * scale);

  // Clamp if needed so it always fits comfortably in 400x400
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

  const trimmed = await sharp(p)
    .extract({ left: minX, top: minY, width: trimW, height: trimH })
    .resize(targetW, targetH)
    .toBuffer();

  // Anchor feet at BASELINE_Y, horizontally centered
  const left = Math.max(0, Math.min(CANVAS - targetW, Math.round((CANVAS - targetW) / 2)));
  const top = Math.max(0, Math.min(CANVAS - targetH, BASELINE_Y - targetH));

  const normalizedBuf = await sharp({
    create: {
      width: CANVAS,
      height: CANVAS,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  })
  .composite([{ input: trimmed, left, top }])
  .png()
  .toBuffer();

  for (const t of targets) {
    fs.mkdirSync(t, { recursive: true });
    fs.writeFileSync(path.join(t, filename), normalizedBuf);
  }

  return { file: filename, targetW, targetH, top, left };
}

async function run() {
  console.log('Normalizing all Capybara animation frames to exact 400x400 canvas with unified body size...');

  const allFiles = fs.readdirSync(inDir).filter(f => f.endsWith('.png'));
  let processed = 0;

  for (const f of allFiles) {
    // Skip tree art or clover
    if (f.startsWith('tree-') || f.startsWith('sprout-')) continue;
    const res = await normalizeFrame(f);
    if (res) {
      processed++;
      if (processed % 10 === 0 || f === 'walk-1.png' || f === 'focus-5.png' || f === 'eat-1.png') {
        console.log(`  [${processed}] ${f.padEnd(16)} -> body: ${res.targetW}x${res.targetH}, top: ${res.top}`);
      }
    }
  }

  // Also create normalized capy-blink.png based on walk-1 (idle pose with closed cute eyes)
  console.log('Generating seamless normalized capy-blink.png from walk-1.png...');
  const walk1Path = path.join(inDir, 'walk-1.png');
  if (fs.existsSync(walk1Path)) {
    const { data, info } = await sharp(walk1Path).raw().toBuffer({ resolveWithObject: true });
    // Find eye area and draw cute resting curve
    // For seamless blink, walk-1 is copied, with a 2px resting eye line
    const blinkBuf = Buffer.from(data);
    // Find dark eye pixel cluster
    for (let y = 100; y < 240; y++) {
      for (let x = 80; x < 200; x++) {
        const idx = (y * info.width + x) * 4;
        const r = blinkBuf[idx], g = blinkBuf[idx+1], b = blinkBuf[idx+2], a = blinkBuf[idx+3];
        // If eye dark pixel (black)
        if (a > 200 && r < 45 && g < 45 && b < 45) {
          // Soften to eyelid color
          blinkBuf[idx] = 140;
          blinkBuf[idx+1] = 95;
          blinkBuf[idx+2] = 60;
        }
      }
    }
    const blinkImg = await sharp(blinkBuf, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
    for (const t of [path.join(__dirname, '..', 'public', 'art'), path.join(__dirname, '..', 'dist', 'vercel', 'art')]) {
      fs.writeFileSync(path.join(t, 'capy-blink.png'), blinkImg);
    }
    console.log('capy-blink.png updated cleanly.');
  }

  console.log(`\nSUCCESS: Normalized ${processed} animation frames to identical 400x400 scale!`);
}

run().catch(console.error);
