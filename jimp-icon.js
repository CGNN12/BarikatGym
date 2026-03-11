const Jimp = require('jimp');
const fs = require('fs');
const path = require('path');

async function main() {
  try {
    const logoFile = path.join(__dirname, 'assets', 'logo.png');
    const adaptiveFile = path.join(__dirname, 'assets', 'adaptive-icon.png');
    const iconFile = path.join(__dirname, 'assets', 'icon.png');

    if (!fs.existsSync(logoFile)) {
      console.error('Logo file not found!');
      return;
    }

    const logo = await Jimp.read(logoFile);

    // Create 1024x1024 transparent for adaptive icon
    const adaptiveIcon = await new Jimp(1024, 1024, 0x00000000); // Transparent
    const x = Math.floor((1024 - logo.bitmap.width) / 2);
    const y = Math.floor((1024 - logo.bitmap.height) / 2);
    
    adaptiveIcon.composite(logo, x, y);
    await adaptiveIcon.writeAsync(adaptiveFile);
    console.log('Successfully created adaptive-icon.png');

    // Create 1024x1024 with #121212 background for main icon
    // hex #121212 is 18, 18, 18 -> 0x121212FF
    const icon = await new Jimp(1024, 1024, 0x121212FF);
    icon.composite(logo, x, y);
    await icon.writeAsync(iconFile);
    console.log('Successfully created icon.png');
    
  } catch (error) {
    console.error('Error generating icons:', error);
  }
}

main();
