const sharp = require('sharp');
const fs = require('fs/promises');
const path = require('path');

const SOURCE_IMAGE = 'C:/Users/razae/Downloads/ChatGPT Image Sep 22, 2026, 10_34_13 PM.png';
const OUT_DIR = 'C:/Users/razae/Documents/ChatGPT/Pacana/public/art/cappy';

const FRAME_SIZE = 256;
const COLS = 6;
const ROWS = 4;
const TOTAL_FRAMES = 24;

async function extractBreakdance() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  console.log('Extracting 24 breakdance frames from:', SOURCE_IMAGE);

  const img = sharp(SOURCE_IMAGE);
  const metadata = await img.metadata();
  console.log(`Source dimensions: ${metadata.width}x${metadata.height}`);

  const frameBuffers = [];

  // Extract each 256x256 frame
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const idx = row * COLS + col;
      const left = col * FRAME_SIZE;
      const top = row * FRAME_SIZE;

      const frameBuffer = await sharp(SOURCE_IMAGE)
        .extract({ left, top, width: FRAME_SIZE, height: FRAME_SIZE })
        .png()
        .toBuffer();

      const outPath = path.join(OUT_DIR, `dance-${idx + 1}.png`);
      await fs.writeFile(outPath, frameBuffer);
      frameBuffers.push(frameBuffer);
      console.log(`✔ Extracted dance-${idx + 1}.png (row ${row}, col ${col})`);
    }
  }

  // Create a single horizontal sprite sheet (6144 x 256)
  console.log('Creating horizontal sprite sheet dance-sheet.png...');
  const compositeInputs = frameBuffers.map((buf, i) => ({
    input: buf,
    left: i * FRAME_SIZE,
    top: 0,
  }));

  const sheetBuffer = await sharp({
    create: {
      width: FRAME_SIZE * TOTAL_FRAMES,
      height: FRAME_SIZE,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(compositeInputs)
    .png()
    .toBuffer();

  const sheetPath = path.join(OUT_DIR, 'dance-sheet.png');
  await fs.writeFile(sheetPath, sheetBuffer);
  console.log(`✔ Successfully generated dance-sheet.png (${FRAME_SIZE * TOTAL_FRAMES}x${FRAME_SIZE})`);
}

extractBreakdance().catch((err) => {
  console.error('Error extracting breakdance frames:', err);
  process.exit(1);
});
