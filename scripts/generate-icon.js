/**
 * Generate build/icon.png (256x256) for electron-builder.
 * Optional: add your own 256x256 PNG at build/icon.png before running npm run dist.
 * Run: node scripts/generate-icon.js
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const buildDir = path.join(__dirname, '..', 'build-resources')
const hero = path.join(__dirname, '..', 'src', 'assets', 'hero.png')

if (!fs.existsSync(buildDir)) {
  fs.mkdirSync(buildDir, { recursive: true })
}

if (fs.existsSync(hero)) {
  fs.copyFileSync(hero, path.join(buildDir, 'icon.png'))
  console.log('Copied src/assets/hero.png → build/icon.png')
} else {
  console.log('No hero.png found; use default Electron icon or add build/icon.png manually')
}
