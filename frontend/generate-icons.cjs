// Script para gerar ícones PWA
// Execute: node generate-icons.js

const fs = require('fs');
const path = require('path');

// Ícone base em formato de Data URL (PNG encoded)
// Vamos criar ícones com canvas se disponível, caso contrário usar placeholder

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

async function generateIcons() {
  try {
    const sharp = require('sharp');
    const svgPath = path.join(__dirname, 'public/icons/icon.svg');
    
    for (const size of sizes) {
      const outputPath = path.join(__dirname, `public/icons/icon-${size}x${size}.png`);
      await sharp(svgPath)
        .resize(size, size)
        .png()
        .toFile(outputPath);
      console.log(`Generated: icon-${size}x${size}.png`);
    }
    
    console.log('All icons generated successfully!');
  } catch (err) {
    console.error('Sharp not available, trying alternative method...');
    console.error('Please install sharp: npm install sharp');
    console.error('Then run: node generate-icons.js');
    
    // Create placeholder message
    console.log('\nAlternatively, you can use an online tool like:');
    console.log('https://www.pwabuilder.com/imageGenerator');
    console.log('Upload the SVG from public/icons/icon.svg');
  }
}

generateIcons();
