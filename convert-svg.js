const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const iconsDir = path.join(__dirname, 'assets', 'icons');
const pngDir = path.join(iconsDir, 'png');
if (!fs.existsSync(pngDir)) fs.mkdirSync(pngDir, { recursive: true });

const files = fs.readdirSync(iconsDir).filter(f => f.endsWith('.svg'));

(async () => {
  for (const file of files) {
    const svgPath = path.join(iconsDir, file);
    const name = path.basename(file, '.svg');
    const svgBuffer = fs.readFileSync(svgPath);
    
    // @2x: 96x96 (48 viewBox × 2)
    await sharp(svgBuffer)
      .resize(96, 96)
      .png()
      .toFile(path.join(pngDir, `${name}@2x.png`));
    
    // @1x: 48x48
    await sharp(svgBuffer)
      .resize(48, 48)
      .png()
      .toFile(path.join(pngDir, `${name}@1x.png`));
    
    // @3x: 144x144
    await sharp(svgBuffer)
      .resize(144, 144)
      .png()
      .toFile(path.join(pngDir, `${name}@3x.png`));
    
    console.log(`  ✓ ${name}`);
  }
  console.log(`\n${files.length} icons → ${pngDir}`);
})().catch(err => { console.error(err); process.exit(1); });
