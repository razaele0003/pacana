const sharp = require('sharp');

const sourceFile = 'C:/Users/razae/.gemini/antigravity/brain/2db0cdf7-5e33-45d3-9033-b0c3d72cdd64/.user_uploaded/media_1789815728520.png';

async function testBadgeColor() {
  const { data, info } = await sharp(sourceFile).raw().toBuffer({ resolveWithObject: true });
  // Sample badge at x=55, y=70
  console.log("Badge pixels sample:");
  for (let dy = -10; dy <= 10; dy += 4) {
    const y = 70 + dy;
    const x = 55;
    const idx = (y * info.width + x) * 4;
    console.log(`x=${x}, y=${y}: R=${data[idx]}, G=${data[idx+1]}, B=${data[idx+2]}`);
  }
}

testBadgeColor();
