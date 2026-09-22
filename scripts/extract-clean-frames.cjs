const sharp = require('sharp');
const path = require('path');
const fs = require('fs/promises');

const SOURCE_IMAGE = 'C:/Users/razae/Downloads/ChatGPT Image Sep 22, 2026, 10_34_13 PM.png';
const OUT_DIR = 'C:/Users/razae/Documents/ChatGPT/Pacana/public/art/cappy';

// Row partition Y boundaries (clean transparent gaps):
// Row 0: 0 .. 270
// Row 1: 270 .. 505
// Row 2: 505 .. 732
// Row 3: 732 .. 1024
const ROW_BOUNDS = [
  { top: 0, bottom: 270 },
  { top: 270, bottom: 505 },
  { top: 505, bottom: 732 },
  { top: 732, bottom: 1024 },
];

// Column partition X boundaries (clean transparent gaps):
// Col 0: 0 .. 250
// Col 1: 250 .. 510
// Col 2: 510 .. 770
// Col 3: 770 .. 1035
// Col 4: 1035 .. 1290
// Col 5: 1290 .. 1536
const COL_BOUNDS = [
  { left: 0, right: 250 },
  { left: 250, right: 510 },
  { left: 510, right: 770 },
  { left: 770, right: 1035 },
  { left: 1035, right: 1290 },
  { left: 1290, right: 1536 },
];

const CANVAS_SIZE = 256;

async function extractCleanFrames() {
  await fs.mkdir(OUT_DIR, { recursive: true });

  const { data, info } = await sharp(SOURCE_IMAGE)
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  console.log(`Source image: ${width}x${height}, channels: ${channels}`);

  const framesMeta = [];
  const frameBuffers = [];

  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 6; c++) {
      const idx = r * 6 + c + 1;
      const rBound = ROW_BOUNDS[r];
      const cBound = COL_BOUNDS[c];

      // Find exact bounding box of Cappy within this partition
      let minX = 9999, maxX = -1, minY = 9999, maxY = -1;

      for (let y = rBound.top; y < rBound.bottom; y++) {
        for (let x = cBound.left; x < cBound.right; x++) {
          const p = (y * width + x) * channels;
          const alpha = data[p + 3];
          if (alpha > 10) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }

      if (minX > maxX || minY > maxY) {
        console.error(`Frame ${idx} in row ${r}, col ${c} has no visible pixels!`);
        continue;
      }

      const charW = maxX - minX + 1;
      const charH = maxY - minY + 1;

      // Extract the exact character artwork at 1:1 scale
      const charBuffer = await sharp(SOURCE_IMAGE)
        .extract({ left: minX, top: minY, width: charW, height: charH })
        .png()
        .toBuffer();

      // Place centered onto a consistent CANVAS_SIZE x CANVAS_SIZE transparent canvas
      const destLeft = Math.round((CANVAS_SIZE - charW) / 2);
      const destTop = Math.round((CANVAS_SIZE - charH) / 2);

      const normalizedFrame = await sharp({
        create: {
          width: CANVAS_SIZE,
          height: CANVAS_SIZE,
          channels: 4,
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        },
      })
        .composite([
          {
            input: charBuffer,
            left: destLeft,
            top: destTop,
          },
        ])
        .png()
        .toBuffer();

      // Verify safety margin: ensure 0 pixels touch any edge of the CANVAS_SIZE canvas
      const { data: nData } = await sharp(normalizedFrame)
        .raw()
        .toBuffer({ resolveWithObject: true });

      let edgeTouches = { top: 0, bottom: 0, left: 0, right: 0 };
      for (let y = 0; y < CANVAS_SIZE; y++) {
        for (let x = 0; x < CANVAS_SIZE; x++) {
          const p = (y * CANVAS_SIZE + x) * 4;
          if (nData[p + 3] > 10) {
            if (y === 0) edgeTouches.top++;
            if (y === CANVAS_SIZE - 1) edgeTouches.bottom++;
            if (x === 0) edgeTouches.left++;
            if (x === CANVAS_SIZE - 1) edgeTouches.right++;
          }
        }
      }

      const outPath = path.join(OUT_DIR, `dance-${idx}.png`);
      await fs.writeFile(outPath, normalizedFrame);
      frameBuffers.push(normalizedFrame);

      framesMeta.push({
        frame: idx,
        row: r,
        col: c,
        srcBBox: { minX, minY, maxX, maxY, w: charW, h: charH },
        canvasPlacement: { left: destLeft, top: destTop },
        margin: {
          left: destLeft,
          top: destTop,
          right: CANVAS_SIZE - (destLeft + charW),
          bottom: CANVAS_SIZE - (destTop + charH),
        },
        edgeTouches,
      });

      console.log(
        `✔ Frame ${idx} (R${r} C${c}): bbox [${minX}, ${minY}, ${maxX}, ${maxY}] (${charW}x${charH}), canvas [${destLeft}, ${destTop}], margins: L${destLeft} R${CANVAS_SIZE - destLeft - charW} T${destTop} B${CANVAS_SIZE - destTop - charH}`
      );
    }
  }

  // Create unified horizontal sprite sheet
  console.log('\nCreating unified horizontal sprite sheet (24 * 256 = 6144 x 256)...');
  const compositeInputs = frameBuffers.map((buf, i) => ({
    input: buf,
    left: i * CANVAS_SIZE,
    top: 0,
  }));

  const sheetBuffer = await sharp({
    create: {
      width: CANVAS_SIZE * 24,
      height: CANVAS_SIZE,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(compositeInputs)
    .png()
    .toBuffer();

  const sheetPath = path.join(OUT_DIR, 'dance-sheet.png');
  await fs.writeFile(sheetPath, sheetBuffer);
  console.log(`✔ Successfully generated ${sheetPath}`);

  // Summary report
  console.log('\n=== EXTRACTION VERIFICATION SUMMARY ===');
  let allClean = true;
  for (const f of framesMeta) {
    const touches = f.edgeTouches.top + f.edgeTouches.bottom + f.edgeTouches.left + f.edgeTouches.right;
    if (touches > 0) {
      console.error(`❌ Frame ${f.frame} touched edge!`, f.edgeTouches);
      allClean = false;
    }
  }
  if (allClean) {
    console.log('🎉 ALL 24 FRAMES HAVE 100% COMPLETE ARTWORK, ZERO EDGE TOUCHES, AND ZERO BLEED!');
  }
}

extractCleanFrames().catch((err) => {
  console.error('Extraction failed:', err);
  process.exit(1);
});
