const sharp = require('sharp');
const fs = require('fs');

async function testFrames() {
  console.log('Testing all 24 extracted frames...');
  for (let i = 1; i <= 24; i++) {
    const file = `public/art/cappy/dance-${i}.png`;
    const { data, info } = await sharp(file).raw().toBuffer({ resolveWithObject: true });
    if (info.width !== 256 || info.height !== 256) {
      throw new Error(`Frame ${i} is ${info.width}x${info.height}, expected 256x256!`);
    }

    // Check edges
    let top = 0, bottom = 0, left = 0, right = 0;
    let nonZero = 0;
    for (let y = 0; y < 256; y++) {
      for (let x = 0; x < 256; x++) {
        const a = data[(y * 256 + x) * 4 + 3];
        if (a > 10) {
          nonZero++;
          if (y === 0) top++;
          if (y === 255) bottom++;
          if (x === 0) left++;
          if (x === 255) right++;
        }
      }
    }

    if (top + bottom + left + right > 0) {
      throw new Error(`Frame ${i} touches edge: T${top} B${bottom} L${left} R${right}`);
    }
    if (nonZero < 1000) {
      throw new Error(`Frame ${i} has too few pixels: ${nonZero}`);
    }
    console.log(`✔ Frame ${i}: ${nonZero} opaque pixels, 0 edge touches, padding clean.`);
  }
  console.log('🎉 ALL 24 FRAMES FULLY VERIFIED!');
}
testFrames();
