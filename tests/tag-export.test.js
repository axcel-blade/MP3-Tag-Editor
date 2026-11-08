import { describe, it, expect } from 'vitest'
import { buildTagExport, filterFiles } from '../shared/tag-export.js'

const FIELDS = [
  { key: 'title', label: 'Title' },
  { key: 'artist', label: 'Artist' },
]
const entries = [
  { path: 'C:\\m\\a.mp3', tags: { fileName: 'a.mp3', title: 'Hello, "World"', artist: 'Ünïcode' } },
  { path: 'C:\\m\\b.mp3', tags: { fileName: 'b.mp3', title: '=SUM(A1)', artist: '<b>x</b>' } },
]

describe('buildTagExport', () => {
  it('builds CSV with quoting, BOM and formula protection', () => {
    const csv = buildTagExport('csv', entries, FIELDS)
    expect(csv.startsWith('\uFEFFFile,Title,Artist,Path\r\n')).toBe(true)
    expect(csv).toContain('a.mp3,"Hello, ""World""",Ünïcode,C:\\m\\a.mp3')
    expect(csv).toContain("b.mp3,'=SUM(A1),<b>x</b>")
  })

  it('builds escaped HTML', () => {
    const html = buildTagExport('html', entries, FIELDS, { title: 'My <Report>' })
    expect(html).toContain('<title>My &lt;Report&gt;</title>')
    expect(html).toContain('<td>&lt;b&gt;x&lt;/b&gt;</td>')
    expect(html).toContain('2 files')
  })

  it('builds JSON keyed by field', () => {
    expect(JSON.parse(buildTagExport('json', entries, FIELDS))[0]).toEqual({
      fileName: 'a.mp3',
      title: 'Hello, "World"',
      artist: 'Ünïcode',
      path: 'C:\\m\\a.mp3',
    })
  })

  it('rejects unknown formats', () => {
    expect(() => buildTagExport('xml', entries, FIELDS)).toThrow('Unknown export format')
  })
})

describe('filterFiles', () => {
  const paths = ['/m/Beatles - Help.mp3', '/m/Other.mp3', '/m/Third.mp3']
  const tags = {
    '/m/Other.mp3': { artist: 'The Beatles', album: 'Abbey Road', year: '1969' },
    '/m/Third.mp3': { artist: 'Someone', album: 'Abbey Lane', year: '1999' },
  }
  const keys = ['artist', 'album', 'year']

  it('returns everything for an empty query', () => {
    expect(filterFiles(paths, '  ', tags, keys)).toEqual(paths)
  })

  it('matches plain words against filename and tags', () => {
    expect(filterFiles(paths, 'beatles', tags, keys)).toEqual(['/m/Beatles - Help.mp3', '/m/Other.mp3'])
  })

  it('matches field:value and quoted values, combining terms', () => {
    expect(filterFiles(paths, 'year:19', tags, keys)).toEqual(['/m/Other.mp3', '/m/Third.mp3'])
    expect(filterFiles(paths, 'album:"abbey road"', tags, keys)).toEqual(['/m/Other.mp3'])
    expect(filterFiles(paths, 'abbey year:1999', tags, keys)).toEqual(['/m/Third.mp3'])
  })

  it('treats unknown fields as plain text', () => {
    expect(filterFiles(['/m/x:y.mp3'], 'x:y', {}, keys)).toEqual(['/m/x:y.mp3'])
  })
})
