import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const electronDir = path.join(__dirname, '..', 'node_modules', 'electron')
const pathFile = path.join(electronDir, 'path.txt')
const distDir = path.join(electronDir, 'dist')

if (process.env.SKIP_ELECTRON_BINARY === '1') {
  process.exit(0)
}

function isElectronInstalled() {
  if (!fs.existsSync(pathFile)) return false

  const binaryName = fs.readFileSync(pathFile, 'utf-8').trim()
  if (!binaryName) return false

  return fs.existsSync(path.join(distDir, binaryName))
}

if (isElectronInstalled()) {
  process.exit(0)
}

try {
  execSync('node install.js', { cwd: electronDir, stdio: 'inherit' })
} catch {
  // install.js may fail on some setups; try platform-specific fallback below
}

if (isElectronInstalled()) {
  process.exit(0)
}

if (process.platform === 'win32') {
  const cacheRoot = path.join(process.env.LOCALAPPDATA ?? '', 'electron', 'Cache')
  if (fs.existsSync(cacheRoot)) {
    const version = JSON.parse(fs.readFileSync(path.join(electronDir, 'package.json'), 'utf-8')).version
    const zipName = `electron-v${version}-win32-x64.zip`

    for (const hashDir of fs.readdirSync(cacheRoot)) {
      const zipPath = path.join(cacheRoot, hashDir, zipName)
      if (!fs.existsSync(zipPath)) continue

      fs.rmSync(distDir, { recursive: true, force: true })
      fs.mkdirSync(distDir, { recursive: true })
      execSync(
        `powershell -NoProfile -Command "Expand-Archive -Path '${zipPath.replace(/'/g, "''")}' -DestinationPath '${distDir.replace(/'/g, "''")}' -Force"`,
        { stdio: 'inherit' },
      )
      fs.writeFileSync(pathFile, 'electron.exe')
      process.exit(0)
    }
  }
}

console.error('Electron binary install failed. Run: node node_modules/electron/install.js')
process.exit(1)
