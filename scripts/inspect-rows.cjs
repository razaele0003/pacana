const sharp = require('sharp');
const fs = require('fs/promises');
const path = require('path');

const DIR = 'C:/Users/razae/.gemini/antigravity/brain/2db0cdf7-5e33-45d3-9033-b0c3d72cdd64';
const f1 = path.join(DIR, '.user_uploaded/media_1789800534658.jpg');
const f2 = path.join(DIR, '.user_uploaded/media_1789800534675.jpg');
const outDir = path.join(DIR, 'scratch/frames');

async function inspectLayout() {
  await fs.mkdir(outDir, { recursive: true });

  // Let's sample 3 crops vertically to verify row y positions
  // Crop Row 1
  await sharp(f1).extract({ left: 180, top: 110, width: 800, height: 160 }).toFile(path.join(outDir, 'row-1-strip.png'));
  // Crop Row 2
  await sharp(f1).extract({ left: 180, top: 270, width: 800, height: 160 }).toFile(path.join(outDir, 'row-2-strip.png'));
  // Crop Row 3
  await sharp(f1).extract({ left: 180, top: 430, width: 800, height: 160 }).toFile(path.join(outDir, 'row-3-strip.png'));

  console.log("Saved row strips for Reference 1");

  // Reference 2 has 5 rows in 682 height
  // Header ~70px
  // 5 rows in ~600px -> ~115px per row
  for (let r = 0; r < 5; r++) {
    const top = Math.round(75 + r * 115);
    await sharp(f2).extract({ left: 180, top, width: 800, height: 110 }).toFile(path.join(outDir, `ref2-row-${r+1}.png`));
  }
  console.log("Saved row strips for Reference 2");
}

inspectLayout().catch(console.error);
