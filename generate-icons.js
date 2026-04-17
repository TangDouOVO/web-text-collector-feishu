const fs = require('fs');
const path = require('path');

function createIcon(size) {
  const svgContent = `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="24" height="24" rx="4" fill="#3370ff"/>
  <path d="M6 5H18C18.5523 5 19 5.44772 19 6V19L12 15L5 19V6C5 5.44772 5.44772 5 6 5Z" fill="white"/>
</svg>`;

  return svgContent;
}

const iconSizes = [16, 48, 128];

iconSizes.forEach(size => {
  const svgContent = createIcon(size);
  const filePath = path.join(__dirname, 'icons', `icon${size}.svg`);
  
  fs.writeFileSync(filePath, svgContent);
  console.log(`Created ${filePath}`);
});

console.log('Icons generated successfully!');
