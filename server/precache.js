import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
const files = [
  '/',
  '/manifest.webmanifest',
  '/icon.svg',
  '/icon-192.png',
  '/icon-512.png',
  ...(await fs.readdir('dist/assets')).map((f) => '/assets/' + f),
];
const version = createHash('sha256').update(files.join(',')).digest('hex').slice(0, 12);
let sw = await fs.readFile('public/sw.js', 'utf8');
sw = sw
  .replace(/const CACHE\s*=\s*["']sl-campo-v1["'];/, `const CACHE='sl-campo-${version}';`)
  .replace(/c\.addAll\(\s*\[[\s\S]*?\]\s*\)/, `c.addAll(${JSON.stringify(files)})`);
if (!sw.includes('/assets/'))
  throw Error('Precache não foi gerado. Revise o template do service worker.');
await fs.writeFile('dist/sw.js', sw);
console.log('Service worker: ' + files.length + ' arquivos preparados para offline.');
