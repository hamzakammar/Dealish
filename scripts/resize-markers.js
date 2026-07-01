#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

// Check if sharp is available, if not install it temporarily
async function ensureSharp() {
  try {
    require.resolve('sharp');
    return require('sharp');
  } catch (e) {
    console.log('Installing sharp temporarily...');
    await execAsync('npm install --no-save sharp');
    return require('sharp');
  }
}

async function resizeImage(inputPath, outputPath, width, height) {
  const sharp = await ensureSharp();
  await sharp(inputPath)
    .resize(width, height, {
      kernel: 'lanczos3',
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .png()
    .toFile(outputPath);
  console.log(`✓ Created ${path.basename(outputPath)} (${width}x${height})`);
}

async function main() {
  const assetsDir = path.join(__dirname, '..', 'assets', 'images');

  const images = [
    // Dot markers (original 48x48)
    {
      input: 'marker-dot.png',
      base: 'marker-dot',
      sizes: [
        { suffix: '-lg', width: 48, height: 48 },
        { suffix: '-md', width: 32, height: 32 },
        { suffix: '-sm', width: 24, height: 24 },
      ]
    },
    {
      input: 'marker-dot-selected.png',
      base: 'marker-dot-selected',
      sizes: [
        { suffix: '-lg', width: 48, height: 48 },
        { suffix: '-md', width: 32, height: 32 },
        { suffix: '-sm', width: 24, height: 24 },
      ]
    },
    // Deal markers (original 96x96)
    {
      input: 'marker-deal.png',
      base: 'marker-deal',
      sizes: [
        { suffix: '-lg', width: 96, height: 96 },
        { suffix: '-md', width: 64, height: 64 },
        { suffix: '-sm', width: 48, height: 48 },
      ]
    },
    {
      input: 'marker-deal-selected.png',
      base: 'marker-deal-selected',
      sizes: [
        { suffix: '-lg', width: 96, height: 96 },
        { suffix: '-md', width: 64, height: 64 },
        { suffix: '-sm', width: 48, height: 48 },
      ]
    },
  ];

  for (const image of images) {
    const inputPath = path.join(assetsDir, image.input);

    if (!fs.existsSync(inputPath)) {
      console.error(`✗ Input file not found: ${image.input}`);
      continue;
    }

    console.log(`\nProcessing ${image.input}:`);

    for (const size of image.sizes) {
      const outputPath = path.join(assetsDir, `${image.base}${size.suffix}.png`);
      await resizeImage(inputPath, outputPath, size.width, size.height);
    }
  }

  console.log('\n✓ All images resized successfully!');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
