import { describe, it, expect } from 'vitest'
import { fitWithin, extensionForMime, mimeForFilename } from '../shared/cover-image.js'

describe('fitWithin', () => {
  it('keeps images that already fit, and never upscales', () => {
    expect(fitWithin(400, 300, 500)).toEqual({ width: 400, height: 300, resized: false })
  })

  it('treats 0 as "original size"', () => {
    expect(fitWithin(3000, 3000, 0)).toEqual({ width: 3000, height: 3000, resized: false })
  })

  it('scales the longest edge down, keeping aspect ratio', () => {
    expect(fitWithin(2000, 1000, 500)).toEqual({ width: 500, height: 250, resized: true })
    expect(fitWithin(1000, 3000, 600)).toEqual({ width: 200, height: 600, resized: true })
  })
})

describe('mime helpers', () => {
  it('maps mime types to extensions', () => {
    expect(extensionForMime('image/png')).toBe('png')
    expect(extensionForMime('image/jpeg')).toBe('jpg')
    expect(extensionForMime('')).toBe('jpg')
  })

  it('maps filenames to supported mime types', () => {
    expect(mimeForFilename('Cover.JPEG')).toBe('image/jpeg')
    expect(mimeForFilename('a.png')).toBe('image/png')
    expect(mimeForFilename('a.gif')).toBeNull()
  })
})
