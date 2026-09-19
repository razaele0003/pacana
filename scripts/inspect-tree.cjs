const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const sourceFile = 'C:/Users/razae/.gemini/antigravity/brain/2db0cdf7-5e33-45d3-9033-b0c3d72cdd64/.user_uploaded/media_1789815728520.png';

async function inspect() {
  const meta = await sharp(sourceFile).metadata();
  console.log("Image metadata:", meta);
}

inspect();
