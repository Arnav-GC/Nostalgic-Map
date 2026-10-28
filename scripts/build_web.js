import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.resolve(__dirname, '..');
const wwwDir = path.join(rootDir, 'www');

function copyRecursive(src, dest) {
  if (!fs.existsSync(src)) return;
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    fs.readdirSync(src).forEach((child) => {
      copyRecursive(path.join(src, child), path.join(dest, child));
    });
  } else {
    fs.copyFileSync(src, dest);
  }
}

if (!fs.existsSync(wwwDir)) {
  fs.mkdirSync(wwwDir, { recursive: true });
}

const itemsToCopy = ['index.html', 'manifest.json', 'sw.js', 'css', 'js', 'icons'];

itemsToCopy.forEach((item) => {
  const src = path.join(rootDir, item);
  const dest = path.join(wwwDir, item);
  copyRecursive(src, dest);
  console.log(`Copied ${item} -> www/`);
});

console.log('Build complete: Web assets ready in www/');
