const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const dir = 'C:/Users/razae/Downloads/Animations';
const outDir = 'C:/Users/razae/.gemini/antigravity/brain/2db0cdf7-5e33-45d3-9033-b0c3d72cdd64/scratch/focus-extracted';
fs.mkdirSync(outDir, { recursive: true });

async function extractFocusFrames() {
  const colRanges = [
    [430, 594],   // 1 Approach
    [603, 766],   // 2 Look up
    [775, 938],   // 3 Stand up
    [946, 1110],  // 4 Reach up
    [1118, 1279], // 5 Touch button
    [1288, 1450], // 6 Press
    [1458, 1621], // 7 Button active
    [1629, 1799], // 8 Step back
    [1800, 1962], // 9 Satisfied
    [1971, 2132], // 10 Return to normal
  ];

  for (let i = 0; i < colRanges.length; i++) {
    const [x1, x2] = colRanges[i];
    const width = x2 - x1 + 1;
    const height = 400;

    const { data } = await sharp(path.join(dir, 'Focus click.png'))
      .extract({ left: x1, top: 160, width, height })
      .raw().toBuffer({ resolveWithObject: true });

    const isExcluded = new Uint8Array(width * height);

    // 1. Exclude badge circle in top-left (x < 65, y < 95)
    for (let y = 0; y < 95; y++) {
      for (let x = 0; x < 65; x++) {
        isExcluded[y * width + x] = 1;
      }
    }

    // 2. Exclude bottom text (y >= 315)
    for (let y = 315; y < height; y++) {
      for (let x = 0; x < width; x++) {
        isExcluded[y * width + x] = 1;
      }
    }

    // 3. For y < 140 (where the green button and burst rays reside):
    // Cappy's paw is brown (r > g, r > b, r - b > 20). Everything else in y < 140 is button / card background / burst
    for (let y = 0; y < 140; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 3;
        const r = data[idx], g = data[idx+1], b = data[idx+2];
        const isPaw = (r > 70 && r > g && r > b && (r - b > 18));
        if (!isPaw) {
          isExcluded[y * width + x] = 1;
        }
      }
    }

    // BFS Flood-fill from borders
    const isBg = new Uint8Array(width * height);
    const queue = [];
    for (let x = 0; x < width; x++) {
      queue.push(x);
      queue.push((height - 1) * width + x);
      isBg[x] = 1;
      isBg[(height - 1) * width + x] = 1;
    }
    for (let y = 0; y < height; y++) {
      const idxL = y * width;
      const idxR = y * width + width - 1;
      queue.push(idxL);
      queue.push(idxR);
      isBg[idxL] = 1;
      isBg[idxR] = 1;
    }

    let head = 0;
    while (head < queue.length) {
      const curr = queue[head++];
      const cx = curr % width;
      const cy = Math.floor(curr / width);

      const neighbors = [
        cy > 0 ? curr - width : -1,
        cy < height - 1 ? curr + width : -1,
        cx > 0 ? curr - 1 : -1,
        cx < width - 1 ? curr + 1 : -1
      ];

      for (const n of neighbors) {
        if (n === -1 || isBg[n] === 1) continue;
        if (isExcluded[n] === 1) {
          isBg[n] = 1;
          queue.push(n);
          continue;
        }
        const pIdx = n * 3;
        const r = data[pIdx], g = data[pIdx+1], b = data[pIdx+2];
        if (r >= 236 && g >= 236 && b >= 228) {
          isBg[n] = 1;
          queue.push(n);
        }
      }
    }

    // Connected component analysis on foreground to keep ONLY Cappy (largest component)
    const visited = new Uint8Array(width * height);
    let maxComp = [];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        if (isBg[idx] === 1 || isExcluded[idx] === 1 || visited[idx] === 1) continue;
        const comp = [];
        const cQueue = [idx];
        visited[idx] = 1;
        let cHead = 0;
        while (cHead < cQueue.length) {
          const cCurr = cQueue[cHead++];
          comp.push(cCurr);
          const px = cCurr % width;
          const py = Math.floor(cCurr / width);
          const cNeighbors = [
            py > 0 ? cCurr - width : -1,
            py < height - 1 ? cCurr + width : -1,
            px > 0 ? cCurr - 1 : -1,
            px < width - 1 ? cCurr + 1 : -1
          ];
          for (const cn of cNeighbors) {
            if (cn !== -1 && isBg[cn] === 0 && isExcluded[cn] === 0 && visited[cn] === 0) {
              visited[cn] = 1;
              cQueue.push(cn);
            }
          }
        }
        if (comp.length > maxComp.length) {
          maxComp = comp;
        }
      }
    }

    const isCappy = new Uint8Array(width * height);
    for (const pix of maxComp) {
      isCappy[pix] = 1;
    }

    // Build RGBA output
    const outData = Buffer.alloc(width * height * 4);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        const idxIn = idx * 3;
        const idxOut = idx * 4;
        const r = data[idxIn], g = data[idxIn+1], b = data[idxIn+2];
        if (isCappy[idx] === 1) {
          let alpha = 255;
          const brightness = (r + g + b) / 3;
          if (brightness > 230) {
            alpha = Math.max(0, Math.min(255, Math.round((250 - brightness) * 12.75)));
          }
          outData[idxOut] = r;
          outData[idxOut+1] = g;
          outData[idxOut+2] = b;
          outData[idxOut+3] = alpha;
        }
      }
    }

    await sharp(outData, { raw: { width, height, channels: 4 } })
      .toFile(path.join(outDir, `focus-${i + 1}.png`));
  }
  console.log('All 10 focus frames re-extracted with full paw and sprout');
}

extractFocusFrames();
