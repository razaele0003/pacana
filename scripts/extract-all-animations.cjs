const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const dir = 'C:/Users/razae/Downloads/Animations';
const targets = [
  path.join(__dirname, '..', 'public', 'art', 'cappy'),
  path.join(__dirname, '..', 'dist', 'vercel', 'art', 'cappy'),
];

targets.forEach(t => fs.mkdirSync(t, { recursive: true }));

async function extractFrame(sourceFile, cellBox, options = {}) {
  const p = path.join(dir, sourceFile);
  const { data, info } = await sharp(p).extract(cellBox).raw().toBuffer({ resolveWithObject: true });

  const width = info.width;
  const height = info.height;
  const isExcluded = new Uint8Array(width * height);

  // 1. Badge circle in top left
  if (options.badge) {
    const bw = options.badge.w || 70;
    const bh = options.badge.h || 70;
    for (let y = 0; y < bh; y++) {
      for (let x = 0; x < bw; x++) {
        isExcluded[y * width + x] = 1;
      }
    }
  }

  // 2. Optional bottom caption cut (ONLY if specifically requested, default 0 to preserve all feet)
  if (options.bottomCut && options.bottomCut > 0) {
    for (let y = height - options.bottomCut; y < height; y++) {
      for (let x = 0; x < width; x++) {
        isExcluded[y * width + x] = 1;
      }
    }
  }

  // 3. For Focus click: exclude the UI button above Cappy while strictly preserving paw and sprout
  if (options.isFocus) {
    for (let y = 0; y <= 160; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 3;
        const r = data[idx], g = data[idx + 1], b = data[idx + 2];
        const isPaw = r > 70 && r > g + 8 && r > b + 15;
        if (!isPaw) {
          isExcluded[y * width + x] = 1;
        }
      }
    }
  }

  // Flood fill background from outer perimeter
  const isBg = new Uint8Array(width * height);
  const queue = [];
  for (let x = 0; x < width; x++) {
    queue.push(x, (height - 1) * width + x);
    isBg[x] = 1;
    isBg[(height - 1) * width + x] = 1;
  }
  for (let y = 0; y < height; y++) {
    const idxL = y * width;
    const idxR = y * width + width - 1;
    queue.push(idxL, idxR);
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
      const r = data[pIdx], g = data[pIdx + 1], b = data[pIdx + 2];
      // Off-white / paper background
      if (r >= 236 && g >= 236 && b >= 226) {
        isBg[n] = 1;
        queue.push(n);
      }
    }
  }

  // Find largest connected foreground component (Cappy himself)
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
  let minX = width, maxX = 0, minY = height, maxY = 0;
  for (const pix of maxComp) {
    isCappy[pix] = 1;
    const px = pix % width;
    const py = Math.floor(pix / width);
    if (px < minX) minX = px;
    if (px > maxX) maxX = px;
    if (py < minY) minY = py;
    if (py > maxY) maxY = py;
  }

  // Build RGBA with feathered edge alpha
  const outData = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const idxIn = idx * 3;
      const idxOut = idx * 4;
      const r = data[idxIn], g = data[idxIn + 1], b = data[idxIn + 2];
      if (isCappy[idx] === 1) {
        let alpha = 255;
        const brightness = (r + g + b) / 3;
        if (brightness > 230) {
          alpha = Math.max(0, Math.min(255, Math.round((250 - brightness) * 12.75)));
        }
        outData[idxOut] = r;
        outData[idxOut + 1] = g;
        outData[idxOut + 2] = b;
        outData[idxOut + 3] = alpha;
      }
    }
  }

  // Crop tightly with 8px margin
  const cropX = Math.max(0, minX - 8);
  const cropY = Math.max(0, minY - 8);
  const cropW = Math.min(width - cropX, maxX - minX + 17);
  const cropH = Math.min(height - cropY, maxY - minY + 17);

  return sharp(outData, { raw: { width, height, channels: 4 } })
    .extract({ left: cropX, top: cropY, width: cropW, height: cropH });
}

async function saveBoth(sharpImg, filename) {
  const buf = await sharpImg.png().toBuffer();
  for (const t of targets) {
    fs.writeFileSync(path.join(t, filename), buf);
  }
}

async function run() {
  console.log('Extracting all animations with 100% complete feet & paws...');

  // 1. WALKING (8 frames)
  console.log('-> Walking (8 frames)');
  const walkR1 = [[30, 360], [400, 740], [780, 1110], [1160, 1500]];
  const walkR2 = [[30, 360], [400, 740], [780, 1110], [1160, 1500]];
  for (let i = 0; i < 4; i++) {
    const [x1, x2] = walkR1[i];
    const frame = await extractFrame('Walking.png', { left: x1, top: 135, width: x2 - x1 + 1, height: 345 }, { badge: { w: 75, h: 75 } });
    await saveBoth(frame, `walk-${i + 1}.png`);
  }
  for (let i = 0; i < 4; i++) {
    const [x1, x2] = walkR2[i];
    const frame = await extractFrame('Walking.png', { left: x1, top: 520, width: x2 - x1 + 1, height: 355 }, { badge: { w: 75, h: 75 } });
    await saveBoth(frame, `walk-${i + 5}.png`);
  }

  // 2. FOCUS CLICK (10 frames)
  console.log('-> Focus click (10 frames)');
  const focusRanges = [
    [430, 594], [603, 766], [775, 938], [946, 1110], [1118, 1279],
    [1288, 1450], [1458, 1621], [1629, 1799], [1800, 1962], [1971, 2132]
  ];
  for (let i = 0; i < 10; i++) {
    const [x1, x2] = focusRanges[i];
    const frame = await extractFrame('Focus click.png', { left: x1, top: 140, width: x2 - x1 + 1, height: 335 }, { badge: { w: 60, h: 50 }, isFocus: true });
    await saveBoth(frame, `focus-${i + 1}.png`);
  }

  // 3. EATING (10 frames)
  console.log('-> Eating (10 frames)');
  const eatR1 = [[25, 275], [330, 580], [630, 880], [930, 1190], [1235, 1495]];
  const eatR2 = [[25, 280], [330, 585], [625, 875], [925, 1165], [1235, 1480]];
  for (let i = 0; i < 5; i++) {
    const [x1, x2] = eatR1[i];
    const frame = await extractFrame('Eating.png', { left: x1, top: 135, width: x2 - x1 + 1, height: 345 }, { badge: { w: 70, h: 70 } });
    await saveBoth(frame, `eat-${i + 1}.png`);
  }
  for (let i = 0; i < 5; i++) {
    const [x1, x2] = eatR2[i];
    const frame = await extractFrame('Eating.png', { left: x1, top: 520, width: x2 - x1 + 1, height: 335 }, { badge: { w: 70, h: 70 } });
    await saveBoth(frame, `eat-${i + 6}.png`);
  }

  // 4. HAPPY (10 frames)
  console.log('-> Happy (10 frames)');
  const happyR1 = [[25, 265], [330, 580], [630, 880], [925, 1205], [1235, 1495]];
  const happyR2 = [[25, 285], [330, 590], [625, 885], [925, 1195], [1235, 1480]];
  for (let i = 0; i < 5; i++) {
    const [x1, x2] = happyR1[i];
    const frame = await extractFrame('Happy.png', { left: x1, top: 135, width: x2 - x1 + 1, height: 345 }, { badge: { w: 70, h: 70 } });
    await saveBoth(frame, `happy-${i + 1}.png`);
  }
  for (let i = 0; i < 5; i++) {
    const [x1, x2] = happyR2[i];
    const frame = await extractFrame('Happy.png', { left: x1, top: 520, width: x2 - x1 + 1, height: 335 }, { badge: { w: 70, h: 70 } });
    await saveBoth(frame, `happy-${i + 6}.png`);
  }

  // 5. SLEEPING / REST (10 frames + rest.png)
  console.log('-> Sleeping (10 frames + rest.png)');
  const sleepR1 = [[20, 295], [320, 600], [625, 855], [905, 1175], [1205, 1525]];
  const sleepR2 = [[25, 325], [315, 610], [620, 900], [895, 1210], [1215, 1485]];
  for (let i = 0; i < 5; i++) {
    const [x1, x2] = sleepR1[i];
    const frame = await extractFrame('Sleeping.png', { left: x1, top: 135, width: x2 - x1 + 1, height: 345 }, { badge: { w: 70, h: 70 } });
    await saveBoth(frame, `sleep-${i + 1}.png`);
  }
  for (let i = 0; i < 5; i++) {
    const [x1, x2] = sleepR2[i];
    const frame = await extractFrame('Sleeping.png', { left: x1, top: 520, width: x2 - x1 + 1, height: 335 }, { badge: { w: 70, h: 70 } });
    await saveBoth(frame, `sleep-${i + 6}.png`);
    if (i === 2) {
      // frame 8 is the peaceful sleeping loop
      await saveBoth(frame, 'rest.png');
    }
  }

  // 6. STRETCH WAKEUP (10 frames)
  console.log('-> Stretch wakeup (10 frames)');
  const stretchR1 = [[30, 275], [330, 575], [625, 870], [915, 1185], [1230, 1490]];
  const stretchR2 = [[30, 270], [325, 575], [620, 880], [915, 1155], [1225, 1485]];
  for (let i = 0; i < 5; i++) {
    const [x1, x2] = stretchR1[i];
    const frame = await extractFrame('Stretch wakeup.png', { left: x1, top: 135, width: x2 - x1 + 1, height: 345 }, { badge: { w: 70, h: 70 } });
    await saveBoth(frame, `stretch-${i + 1}.png`);
  }
  for (let i = 0; i < 5; i++) {
    const [x1, x2] = stretchR2[i];
    const frame = await extractFrame('Stretch wakeup.png', { left: x1, top: 510, width: x2 - x1 + 1, height: 345 }, { badge: { w: 70, h: 70 } });
    await saveBoth(frame, `stretch-${i + 6}.png`);
  }

  // 7. READING (10 frames)
  console.log('-> Reading (10 frames)');
  const readR1 = [[30, 285], [330, 590], [625, 895], [920, 1195], [1230, 1490]];
  const readR2 = [[30, 295], [330, 605], [625, 895], [920, 1195], [1230, 1520]];
  for (let i = 0; i < 5; i++) {
    const [x1, x2] = readR1[i];
    const frame = await extractFrame('Reading.png', { left: x1, top: 135, width: x2 - x1 + 1, height: 345 }, { badge: { w: 70, h: 70 } });
    await saveBoth(frame, `read-${i + 1}.png`);
  }
  for (let i = 0; i < 5; i++) {
    const [x1, x2] = readR2[i];
    const frame = await extractFrame('Reading.png', { left: x1, top: 520, width: x2 - x1 + 1, height: 335 }, { badge: { w: 70, h: 70 } });
    await saveBoth(frame, `read-${i + 6}.png`);
  }

  console.log('Extraction complete! All 68 animation frames saved with fully intact feet, paws, and sprouts.');
}

run().catch(console.error);
