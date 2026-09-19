const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const sourceFile = 'C:/Users/razae/.gemini/antigravity/brain/2db0cdf7-5e33-45d3-9033-b0c3d72cdd64/.user_uploaded/media_1789815728520.png';
const artifactDir = 'C:/Users/razae/.gemini/antigravity/brain/2db0cdf7-5e33-45d3-9033-b0c3d72cdd64';

const outputDirs = [
  path.join(__dirname, '..', 'public', 'art', 'tree'),
  path.join(__dirname, '..', 'dist', 'vercel', 'art', 'tree'),
];

async function extract() {
  const { data, info } = await sharp(sourceFile).raw().toBuffer({ resolveWithObject: true });
  const sheetW = info.width;
  const sheetH = info.height;
  const channels = info.channels;

  const cols = 5;
  const rows = 2;
  const cellW = sheetW / cols;
  const cellH = sheetH / rows;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const stageNum = r * cols + c + 1;
      const left = Math.round(c * cellW);
      const right = Math.round((c + 1) * cellW);
      const top = Math.round(r * cellH);
      const bottom = Math.round((r + 1) * cellH);
      const w = right - left;
      const h = bottom - top;

      const cellPixels = Buffer.alloc(w * h * 4);
      let minX = w, maxX = 0, minY = h, maxY = 0;

      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const sheetX = left + x;
          const sheetY = top + y;
          const srcIdx = (sheetY * sheetW + sheetX) * channels;
          const dstIdx = (y * w + x) * 4;

          const red = data[srcIdx];
          const green = data[srcIdx + 1];
          const blue = data[srcIdx + 2];
          const alpha = channels === 4 ? data[srcIdx + 3] : 255;

          // Clear the badge in top left:
          // In row 0 (stages 1-5): badge is within x < 85 && y < 105
          // In row 1 (stages 6-10): badge is within x < 62 && y < 85
          const isBadge = (r === 0 && x < 85 && y < 105) || (r === 1 && x < 62 && y < 85);

          // White/cream background detection
          const isWhiteBg = red > 245 && green > 245 && blue > 245;

          if (isBadge || isWhiteBg || alpha < 20) {
            cellPixels[dstIdx] = 0;
            cellPixels[dstIdx + 1] = 0;
            cellPixels[dstIdx + 2] = 0;
            cellPixels[dstIdx + 3] = 0;
          } else {
            let edgeAlpha = 255;
            if (red > 230 && green > 230 && blue > 230) {
              const maxBright = Math.max(red, green, blue);
              edgeAlpha = Math.max(0, Math.min(255, Math.round((255 - maxBright) * (255 / 25))));
            }

            cellPixels[dstIdx] = red;
            cellPixels[dstIdx + 1] = green;
            cellPixels[dstIdx + 2] = blue;
            cellPixels[dstIdx + 3] = edgeAlpha;

            if (edgeAlpha > 20) {
              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
              if (y < minY) minY = y;
              if (y > maxY) maxY = y;
            }
          }
        }
      }

      console.log(`Stage ${stageNum}: bounds x=${minX}..${maxX}, y=${minY}..${maxY}, size=${maxX - minX + 1}x${maxY - minY + 1}`);

      const pad = 4;
      const cropX = Math.max(0, minX - pad);
      const cropY = Math.max(0, minY - pad);
      const cropW = Math.min(w - cropX, maxX - minX + 1 + pad * 2);
      const cropH = Math.min(h - cropY, maxY - minY + 1 + pad * 2);

      const croppedBuffer = await sharp(cellPixels, {
        raw: { width: w, height: h, channels: 4 }
      })
        .extract({ left: cropX, top: cropY, width: cropW, height: cropH })
        .png()
        .toBuffer();

      for (const outDir of outputDirs) {
        fs.writeFileSync(path.join(outDir, `tree-${stageNum}.png`), croppedBuffer);
      }
      fs.writeFileSync(path.join(artifactDir, `tree-stage-${stageNum}.png`), croppedBuffer);
    }
  }

  console.log("Extracted clean stages!");
}

extract().catch(console.error);
