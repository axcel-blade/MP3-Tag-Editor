/**
 * Render the app icon from docs/assets/icon.svg into the PNGs the app and installers use:
 *   docs/assets/icon.png            1024×1024 (docs / README)
 *   build-resources/icon.png        1024×1024 (electron-builder → .ico / .icns / Linux icons)
 *   public/icon.png                 256×256   (window icon at runtime, copied into dist/)
 *   public/favicon.svg              copy of the SVG (renderer favicon)
 *
 * Uses Electron's offscreen renderer, so no extra image dependencies are needed.
 * Run after editing the SVG:  pnpm exec electron scripts/generate-icon.js
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { app, BrowserWindow } from 'electron'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const source = path.join(root, 'docs', 'assets', 'icon.svg')

const outputs = [
  { file: path.join(root, 'docs', 'assets', 'icon.png'), size: 1024 },
  { file: path.join(root, 'build-resources', 'icon.png'), size: 1024 },
  { file: path.join(root, 'public', 'icon.png'), size: 256 },
]

const RENDER_SIZE = 1024

/** Render the SVG once at size×size with a transparent background; returns a NativeImage. */
async function renderImage(svg, size) {
  const win = new BrowserWindow({
    width: size,
    height: size,
    show: false,
    frame: false,
    transparent: true,
    useContentSize: true,
    webPreferences: { offscreen: true },
  })
  win.webContents.setFrameRate(1)

  const html = `<!doctype html><html><body style="margin:0;background:transparent;overflow:hidden">
<img src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}" width="${size}" height="${size}" style="display:block">
</body></html>`

  const frame = new Promise((resolve) => {
    win.webContents.on('paint', (_event, _dirty, image) => {
      const { width, height } = image.getSize()
      if (width >= size && height >= size) resolve(image)
    })
  })
  await win.loadURL(`data:text/html;base64,${Buffer.from(html).toString('base64')}`)
  const image = await frame
  win.destroy()
  return image.resize({ width: size, height: size, quality: 'best' })
}

app.whenReady().then(async () => {
  try {
    const image = await renderImage(fs.readFileSync(source, 'utf8'), RENDER_SIZE)
    for (const { file, size } of outputs) {
      fs.mkdirSync(path.dirname(file), { recursive: true })
      const png = size === RENDER_SIZE ? image.toPNG() : image.resize({ width: size, height: size, quality: 'best' }).toPNG()
      fs.writeFileSync(file, png)
      console.log(`Wrote ${path.relative(root, file)} (${size}×${size})`)
    }
    fs.copyFileSync(source, path.join(root, 'public', 'favicon.svg'))
    console.log('Wrote public/favicon.svg')
    app.exit(0)
  } catch (err) {
    console.error(err)
    app.exit(1)
  }
})
