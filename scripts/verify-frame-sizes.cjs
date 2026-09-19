const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const dir = path.join(__dirname, '..', 'public', 'art', 'cappy');

async function check() {
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.png'));
  console.log('Total png files in public/art/cappy:', files.length);

  const groups = {};
  for (const f of files) {
    const meta = await sharp(path.join(dir, f)).metadata();
    const group = f.split('-')[0].split('.')[0];
    if (!groups[group]) groups[group] = [];
    groups[group].push({ file: f, w: meta.width, h: meta.height });
  }

  for (const [grp, items] of Object.entries(groups)) {
    console.log(`\nGroup: ${grp} (${items.length} frames)`);
    items.forEach(it => console.log(`  ${it.file}: ${it.w}x${it.h}`));
  }
}

check();
