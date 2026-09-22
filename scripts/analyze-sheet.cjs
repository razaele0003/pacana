const sharp = require('sharp');

async function findBlobs() {
  const { data, info } = await sharp('C:/Users/razae/Downloads/ChatGPT Image Sep 22, 2026, 10_34_13 PM.png')
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  console.log('Image:', width, 'x', height);

  for (let c = 0; c < 6; c++) {
    const x0 = c * 256;
    const x1 = (c + 1) * 256;
    console.log('\n=== Column', c, `(x: ${x0}..${x1}) ===`);

    let inChar = false;
    let charStart = 0;
    let chars = [];

    for (let y = 0; y < height; y++) {
      let count = 0;
      for (let x = x0; x < x1; x++) {
        if (data[(y * width + x) * channels + 3] > 10) count++;
      }

      if (count > 0 && !inChar) {
        inChar = true;
        charStart = y;
      } else if (count === 0 && inChar) {
        inChar = false;
        chars.push({ startY: charStart, endY: y - 1, height: y - charStart });
      }
    }
    if (inChar) {
      chars.push({ startY: charStart, endY: height - 1, height: height - charStart });
    }

    console.log(`Found ${chars.length} characters in col ${c}:`);
    chars.forEach((ch, i) => {
      let minX = 9999, maxX = -1;
      for (let y = ch.startY; y <= ch.endY; y++) {
        for (let x = x0; x < x1; x++) {
          if (data[(y * width + x) * channels + 3] > 10) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
          }
        }
      }
      console.log(`  Char ${i+1}: Y: [${ch.startY}..${ch.endY}] (h: ${ch.height}), X: [${minX}..${maxX}] (w: ${maxX - minX + 1})`);
    });
  }
}
findBlobs();
