const sharp = require('sharp');
const fs = require('fs/promises');
const path = require('path');

const DIR = 'C:/Users/razae/.gemini/antigravity/brain/2db0cdf7-5e33-45d3-9033-b0c3d72cdd64';
const f1 = path.join(DIR, '.user_uploaded/media_1789800534658.jpg');
const f2 = path.join(DIR, '.user_uploaded/media_1789800534675.jpg');
const OUT_DIR = 'C:/Users/razae/Documents/ChatGPT/Pacana/public/art/cappy';

/**
 * Perform BFS flood-fill transparency from the outer borders.
 * mode: "light" (for light cream backgrounds) or "dark" (for forest green background)
 */
async function processTransparency(buffer, width, height, mode) {
  const visited = new Uint8Array(width * height);
  const queue = [];

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
    const r = buffer[dIdx];
    const g = buffer[dIdx + 1];
    const b = buffer[dIdx + 2];

    if (mode === 'light') {
      // Light cream/white background (#faf8f3 to #f5f3ec)
      const isBg = r > 220 && g > 218 && b > 210 && Math.abs(r - g) < 22 && Math.abs(r - b) < 32;
      if (isBg) {
        buffer[dIdx + 3] = 0;
        queue.push(x + 1, y, x - 1, y, x, y + 1, x, y - 1);
      } else if (r > 200 && g > 196 && b > 185 && Math.abs(r - g) < 24 && Math.abs(r - b) < 34) {
        const factor = (r - 200) / 20;
        buffer[dIdx + 3] = Math.round(255 * (1 - factor));
      }
    } else {
      // Dark green background (#103323 to #1a4430)
      // Capybara is warm brown (r: 180-230, g: 120-170, b: 70-110)
      // Hearts are pink/red (r > 200, g < 150)
      // Green background has r < 60, b < 70, g between 35 and 90
      const isBg = r < 75 && b < 80 && g >= 25 && g < 110 && (g > r + 10 || g > b + 5);
      if (isBg) {
        buffer[dIdx + 3] = 0;
        queue.push(x + 1, y, x - 1, y, x, y + 1, x, y - 1);
      } else if (r < 95 && b < 95 && g < 125 && g > r) {
        const factor = Math.max(0, Math.min(1, (100 - r) / 30));
        buffer[dIdx + 3] = Math.round(255 * (1 - factor));
      }
    }
  }

  return sharp(buffer, { raw: { width, height, channels: 4 } }).png().toBuffer();
}

async function extractFrame(sourcePath, rect, destPath, mode) {
  const { data, info } = await sharp(sourcePath)
    .extract(rect)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const transparentBuffer = await processTransparency(data, info.width, info.height, mode);
  await fs.writeFile(destPath, transparentBuffer);
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  console.log("Extracting frames to", OUT_DIR);

  // 1. Walking (10 frames)
  for (let i = 0; i < 10; i++) {
    const left = Math.round(182 + i * 80.8);
    await extractFrame(
      f1,
      { left, top: 112, width: 76, height: 78 },
      path.join(OUT_DIR, `walk-${i + 1}.png`),
      'light'
    );
  }
  console.log("✔ Extracted 10 walk frames");

  // 2. Planting (10 frames)
  for (let i = 0; i < 10; i++) {
    const left = Math.round(182 + i * 80.8);
    await extractFrame(
      f1,
      { left, top: 268, width: 76, height: 78 },
      path.join(OUT_DIR, `plant-${i + 1}.png`),
      'light'
    );
  }
  console.log("✔ Extracted 10 plant frames");

  // 3. Pressing Focus (10 frames)
  for (let i = 0; i < 10; i++) {
    const left = Math.round(182 + i * 80.8);
    await extractFrame(
      f1,
      { left, top: 430, width: 76, height: 96 },
      path.join(OUT_DIR, `focus-${i + 1}.png`),
      'light'
    );
  }
  console.log("✔ Extracted 10 focus frames");

  // 4. Rest (Peaceful sleeping capybara)
  await extractFrame(
    f1,
    { left: 716, top: 574, width: 138, height: 86 },
    path.join(OUT_DIR, 'rest.png'),
    'light'
  );
  console.log("✔ Extracted rest artwork");

  // 5. Happy Emote (8 frames)
  for (let i = 0; i < 8; i++) {
    const left = Math.round(184 + i * 74.2);
    await extractFrame(
      f2,
      { left, top: 76, width: 70, height: 68 },
      path.join(OUT_DIR, `happy-${i + 1}.png`),
      'dark'
    );
  }
  console.log("✔ Extracted 8 happy frames");

  // 6. Curious Emote (8 frames)
  for (let i = 0; i < 8; i++) {
    const left = Math.round(184 + i * 74.2);
    await extractFrame(
      f2,
      { left, top: 190, width: 70, height: 68 },
      path.join(OUT_DIR, `curious-${i + 1}.png`),
      'dark'
    );
  }
  console.log("✔ Extracted 8 curious frames");

  // 7. Excited Emote (8 frames)
  for (let i = 0; i < 8; i++) {
    const left = Math.round(184 + i * 74.2);
    await extractFrame(
      f2,
      { left, top: 304, width: 70, height: 68 },
      path.join(OUT_DIR, `excited-${i + 1}.png`),
      'dark'
    );
  }
  console.log("✔ Extracted 8 excited frames");

  // 8. Eating Action (10 frames)
  for (let i = 0; i < 10; i++) {
    const left = Math.round(206 + i * 58.8);
    await extractFrame(
      f2,
      { left, top: 418, width: 42, height: 68 },
      path.join(OUT_DIR, `eat-${i + 1}.png`),
      'dark'
    );
  }
  console.log("✔ Extracted 10 eating frames");

  // 9. Thinking Emote (8 frames)
  for (let i = 0; i < 8; i++) {
    const left = Math.round(184 + i * 74.2);
    await extractFrame(
      f2,
      { left, top: 532, width: 70, height: 68 },
      path.join(OUT_DIR, `think-${i + 1}.png`),
      'dark'
    );
  }
  console.log("✔ Extracted 8 thinking frames");

  console.log("ALL 75 FRAMES EXTRACTED AND SAVED WITH TRANSPARENCY!");
}

main().catch(console.error);
