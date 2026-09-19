const sharp = require('sharp');

const sourceFile = 'C:/Users/razae/.gemini/antigravity/brain/2db0cdf7-5e33-45d3-9033-b0c3d72cdd64/.user_uploaded/media_1789815728520.png';

async function testCell10() {
  const { data, info } = await sharp(sourceFile).raw().toBuffer({ resolveWithObject: true });
  // Cell 10 is row 1 (y = 256..512), col 4 (x = 819..1024)
  const left = 819;
  const top = 256;
  const w = 1024 - 819;
  const h = 256;

  console.log("Stage 10 (Cell 10) badge area vs tree canopy:");
  for (let y = 40; y <= 100; y += 4) {
    let rowStr = '';
    for (let x = 30; x <= 90; x += 4) {
      const srcIdx = ((top + y) * info.width + (left + x)) * 4;
      const r = data[srcIdx], g = data[srcIdx+1], b = data[srcIdx+2];
      const isWhite = r > 240 && g > 240 && b > 240;
      rowStr += isWhite ? '.' : '#';
    }
    console.log(`y=${y}: ${rowStr}`);
  }
}

testCell10();
