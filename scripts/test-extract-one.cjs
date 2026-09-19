const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const dir = 'C:/Users/razae/Downloads/Animations';
const outDir = 'C:/Users/razae/.gemini/antigravity/brain/2db0cdf7-5e33-45d3-9033-b0c3d72cdd64/scratch/test-transparent';
fs.mkdirSync(outDir, { recursive: true });

async function extractTransparentFrame(sourceFile, cellBox, options = {}) {
  // cellBox: { left, top, width, height }
  // options:
  //   ignoreTopBadge: boolean (cut off top-left badge)
  //   ignoreBottomText: number (pixels from bottom to ignore)
  //   ignoreTopButton: number (for focus click, ignore y < ignoreTopButton unless Cappy paw reaches up)
  //   removeZzz: boolean (for sleeping, remove pixels in top right of sleeping body)

  const p = path.join(dir, sourceFile);
  const { data, info } = await sharp(p).extract(cellBox).raw().toBuffer({ resolveWithObject: true });

  const width = info.width;
  const height = info.height;
  const channels = info.channels; // 3

  // Create RGBA buffer
  const outData = Buffer.alloc(width * height * 4);

  // First pass: mask out known non-character regions (badge circle, bottom text, button above)
  const isExcluded = new Uint8Array(width * height);

  // Exclude badge: typically top-left corner
  if (options.ignoreTopBadge) {
    const badgeW = Math.floor(width * 0.35);
    const badgeH = Math.floor(height * 0.35);
    for (let y = 0; y < badgeH; y++) {
      for (let x = 0; x < badgeW; x++) {
        // badge is a circle with light beige fill
        isExcluded[y * width + x] = 1;
      }
    }
  }

  // Exclude bottom text
  const btmCut = options.ignoreBottomText || 40;
  for (let y = height - btmCut; y < height; y++) {
    for (let x = 0; x < width; x++) {
      isExcluded[y * width + x] = 1;
    }
  }

  // Exclude top button in Focus click
  if (options.ignoreTopButton) {
    for (let y = 0; y < options.ignoreTopButton; y++) {
      for (let x = 0; x < width; x++) {
        // Keep only if paw color (fur tone)
        const idx = (y * width + x) * channels;
        const r = data[idx], g = data[idx+1], b = data[idx+2];
        const isFur = r > 120 && g > 70 && b < 90 && (r - b > 40);
        if (!isFur) {
          isExcluded[y * width + x] = 1;
        }
      }
    }
  }

  // Exclude Zzz if sleeping
  if (options.removeZzz) {
    // Zzz is in upper right (x > width * 0.6, y < height * 0.5)
    for (let y = 0; y < Math.floor(height * 0.45); y++) {
      for (let x = Math.floor(width * 0.6); x < width; x++) {
        isExcluded[y * width + x] = 1;
      }
    }
  }

  // Identify background: BFS flood-fill from perimeter
  const isBg = new Uint8Array(width * height);
  const queue = [];

  // Seed boundary
  for (let x = 0; x < width; x++) {
    queue.push(x); // y = 0
    queue.push((height - 1) * width + x); // y = height - 1
    isBg[x] = 1;
    isBg[(height - 1) * width + x] = 1;
  }
  for (let y = 0; y < height; y++) {
    const idxL = y * width;
    const idxR = y * width + width - 1;
    queue.push(idxL);
    queue.push(idxR);
    isBg[idxL] = 1;
    isBg[idxR] = 1;
  }

  // BFS
  let head = 0;
  while (head < queue.length) {
    const curr = queue[head++];
    const cx = curr % width;
    const cy = Math.floor(curr / width);

    // check 4 neighbors
    const neighbors = [
      cy > 0 ? curr - width : -1,
      cy < height - 1 ? curr + width : -1,
      cx > 0 ? curr - 1 : -1,
      cx < width - 1 ? curr + 1 : -1
    ];

    for (const n of neighbors) {
      if (n === -1 || isBg[n] === 1) continue;
      
      // If excluded, it definitely propagates as background
      if (isExcluded[n] === 1) {
        isBg[n] = 1;
        queue.push(n);
        continue;
      }

      // Check if pixel is background (near white / cream / very light grey)
      const pIdx = n * channels;
      const r = data[pIdx], g = data[pIdx+1], b = data[pIdx+2];

      // White/cream threshold
      if (r >= 238 && g >= 238 && b >= 230) {
        isBg[n] = 1;
        queue.push(n);
      } else if (r >= 244 && g >= 244 && b >= 240) {
        isBg[n] = 1;
        queue.push(n);
      }
    }
  }

  // Now populate outData (RGBA)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idxIn = (y * width + x) * channels;
      const idxOut = (y * width + x) * 4;
      const r = data[idxIn], g = data[idxIn+1], b = data[idxIn+2];

      if (isExcluded[y * width + x] === 1 || isBg[y * width + x] === 1) {
        outData[idxOut] = 0;
        outData[idxOut+1] = 0;
        outData[idxOut+2] = 0;
        outData[idxOut+3] = 0;
      } else {
        // Anti-aliasing near boundary
        let alpha = 255;
        const brightness = (r + g + b) / 3;
        if (brightness > 230) {
          alpha = Math.max(0, Math.min(255, Math.round((250 - brightness) * 12.75)));
        }
        outData[idxOut] = r;
        outData[idxOut+1] = g;
        outData[idxOut+2] = b;
        outData[idxOut+3] = alpha;
      }
    }
  }

  return sharp(outData, { raw: { width, height, channels: 4 } });
}

(async () => {
  // Test 1: Walking frame 1
  const w1 = await extractTransparentFrame('Walking.png', { left: 35, top: 150, width: 316, height: 340 }, { ignoreTopBadge: true, ignoreBottomText: 45 });
  await w1.toFile(path.join(outDir, 'test-walk-1.png'));

  // Test 2: Focus click frame 5 (touch button)
  const f5 = await extractTransparentFrame('Focus click.png', { left: 1118, top: 160, width: 162, height: 410 }, { ignoreTopBadge: true, ignoreBottomText: 55, ignoreTopButton: 120 });
  await f5.toFile(path.join(outDir, 'test-focus-5.png'));

  // Test 3: Sleeping frame 8 (sleeping loop without zzz)
  const s8 = await extractTransparentFrame('Sleeping.png', { left: 626, top: 510, width: 268, height: 350 }, { ignoreTopBadge: true, ignoreBottomText: 50, removeZzz: true });
  await s8.toFile(path.join(outDir, 'test-sleep-8.png'));

  // Test 4: Eating frame 1
  const e1 = await extractTransparentFrame('Eating.png', { left: 29, top: 150, width: 236, height: 340 }, { ignoreTopBadge: true, ignoreBottomText: 45 });
  await e1.toFile(path.join(outDir, 'test-eat-1.png'));

  console.log('Test extractions complete');
})();
