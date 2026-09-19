const sharp = require('sharp');
const path = require('path');

async function testNodeFloodFill() {
  const input = 'C:/Users/razae/.gemini/antigravity/brain/2db0cdf7-5e33-45d3-9033-b0c3d72cdd64/scratch/slice-walk-1-v2.png';
  const output = 'C:/Users/razae/.gemini/antigravity/brain/2db0cdf7-5e33-45d3-9033-b0c3d72cdd64/scratch/walk-1-transparent.png';

  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  const visited = new Uint8Array(width * height);
  const queue = [];

  // Sample corner pixel color as background
  const bgR = data[0];
  const bgG = data[1];
  const bgB = data[2];

  // Seed borders
  for (let x = 0; x < width; x++) {
    queue.push(x, 0);
    queue.push(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    queue.push(0, y);
    queue.push(width - 1, y);
  }

  let head = 0;
  while (head < queue.length) {
    const x = queue[head++];
    const y = queue[head++];
    if (x < 0 || x >= width || y < 0 || y >= height) continue;
    const pIdx = y * width + x;
    if (visited[pIdx]) continue;
    visited[pIdx] = 1;

    const dIdx = pIdx * 4;
    const r = data[dIdx];
    const g = data[dIdx + 1];
    const b = data[dIdx + 2];

    // Distance to light background (cream/white)
    // In reference 1, background is around (245, 243, 237)
    const isLightBg = r > 220 && g > 218 && b > 210 && Math.abs(r - g) < 20 && Math.abs(r - b) < 30;

    if (isLightBg) {
      data[dIdx + 3] = 0; // Transparent
      queue.push(x + 1, y, x - 1, y, x, y + 1, x, y - 1);
    } else if (r > 200 && g > 195 && b > 185 && Math.abs(r - g) < 22 && Math.abs(r - b) < 32) {
      // Soft anti-aliased edge
      const factor = (r - 200) / 20;
      data[dIdx + 3] = Math.round(255 * (1 - factor));
    }
  }

  await sharp(data, { raw: { width, height, channels } })
    .png()
    .toFile(output);

  console.log('Saved transparent walk frame!');
}

testNodeFloodFill().catch(console.error);
