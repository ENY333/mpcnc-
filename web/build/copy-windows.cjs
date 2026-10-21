const fs = require('node:fs');
const path = require('node:path');
const {version} = require('../package.json');
const file = `CNC-Note-${version}-Windows-x64.exe`;
const source = path.join(__dirname, '..', 'dist', file);
const target = path.join(__dirname, '..', '..', 'desktop', file);
// Keep only the portable executable in the public desktop folder.
fs.mkdirSync(path.dirname(target), {recursive: true});
fs.copyFileSync(source, target);
console.log(`Windows download: ${target}`);
