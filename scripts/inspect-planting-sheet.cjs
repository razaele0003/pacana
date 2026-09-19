const sharp = require('sharp');
const path = require('path');

const src = 'C:/Users/razae/.gemini/antigravity/brain/2db0cdf7-5e33-45d3-9033-b0c3d72cdd64/.user_uploaded/media_1789819801760.png';

async function main() {
  const metadata = await sharp(src).metadata();
  console.log('Metadata:', metadata);

  const { data, info } = await sharp(src).raw().toBuffer({ resolveWithObject: true });
  console.log(`Dimensions: ${info.width}x${info.height}, channels: ${info.channels}`);

  // Sample corner pixel
  console.log('Top-left pixel:', {
    r: data[0],
    g: data[1],
    b: data[2],
    a: info.channels === 4 ? data[3] : 255
  });

  // Check column projection to find the 8 sprites
  const colNonWhite = new Array(info.width).fill(0);
  for (let x = 0; x < info.width; x++) {
    for (let y = 0; y < info.height; y++) {
      const idx = (y * info.width + x) * info.channels;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const a = info.channels === 4 ? data[idx + 3] : 255;
      // If not white / transparent
      if (a > 30 && (r < 240 || g < 240 || b < 240)) {
        colNonWhite[x]++;
      }
    }
  }

  // Find intervals of columns that contain sprite content
  const segments = [];
  let inSegment = false;
  let startX = 0;
  for (let x = 0; x < info.width; x++) {
    if (colNonWhite[x] > 5) {
      if (!inSegment) {
        inSegment = true;
        startX = x;
      }
    } else {
      if (inSegment) {
        inSegment = false;
        segments.push({ startX, endX: x - 1, width: x - startX });
      }
    }
  }
  if (inSegment) {
    segments.push({ startX, endX: info.width - 1, width: info.width - startX });
  }

  console.log(`Found ${segments.length} column segments:`, segments);
}

main().catch(console.error);
