const sharp = require('sharp');

const sourceFile = 'C:/Users/razae/.gemini/antigravity/brain/2db0cdf7-5e33-45d3-9033-b0c3d72cdd64/.user_uploaded/media_1789815728520.png';

async function test() {
  const { data, info } = await sharp(sourceFile).raw().toBuffer({ resolveWithObject: true });
  const w = Math.round(info.width / 5);
  const h = Math.round(info.height / 2);

  // Print non-white clusters in cell 1
  for (let y = 0; y < h; y += 8) {
    let rowStr = '';
    for (let x = 0; x < w; x += 8) {
      const idx = (y * info.width + x) * 4;
      const isWhite = data[idx] > 240 && data[idx+1] > 240 && data[idx+2] > 240;
      rowStr += isWhite ? '.' : '#';
    }
    console.log(`${String(y).padStart(3, ' ')}: ${rowStr}`);
  }
}

test();
