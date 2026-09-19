const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const dir = 'C:/Users/razae/Downloads/Animations';

async function examineFrames(file) {
  const p = path.join(dir, file);
  const { data, info } = await sharp(p).raw().toBuffer({ resolveWithObject: true });
  console.log('\n========================================');
  console.log('FILE:', file);

  const examineRow = (rowName, yMin, yMax) => {
    const colProj = new Array(info.width).fill(0);
    for (let x = 0; x < info.width; x++) {
      for (let y = yMin; y <= yMax; y++) {
        const idx = (y * info.width + x) * info.channels;
        if (data[idx] < 240 || data[idx+1] < 240 || data[idx+2] < 240) {
          colProj[x]++;
        }
      }
    }
    const segs = [];
    let inS = false, s = 0;
    for (let x = 0; x < info.width; x++) {
      if (colProj[x] > 5) {
        if (!inS) { inS = true; s = x; }
      } else {
        if (inS) {
          inS = false;
          if (x - s > 15) segs.push([s, x]);
        }
      }
    }
    if (inS && info.width - s > 15) segs.push([s, info.width]);

    console.log(rowName, 'segments count:', segs.length);
    segs.forEach(([x1, x2], i) => {
      let minX = x2, maxX = x1, minY = yMax, maxY = yMin;
      let pixelCount = 0;
      for (let x = x1; x <= x2; x++) {
        for (let y = yMin; y <= yMax; y++) {
          const idx = (y * info.width + x) * info.channels;
          if (data[idx] < 240 || data[idx+1] < 240 || data[idx+2] < 240) {
            pixelCount++;
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }
      console.log(`  [${i+1}] x:[${minX}..${maxX}] (w:${maxX-minX+1}) y:[${minY}..${maxY}] (h:${maxY-minY+1}) pixels:${pixelCount}`);
    });
  };

  if (file === 'Focus click.png') {
    examineRow('Row 1', 150, 550);
  } else {
    examineRow('Row 1', 140, 490);
    examineRow('Row 2', 500, 890);
  }
}

(async () => {
  for (const f of fs.readdirSync(dir)) {
    if (f.endsWith('.png')) await examineFrames(f);
  }
})();
