import { describe, it, expect } from 'vitest'
import { formatM3U, parseM3U, playlistTitle } from '../shared/playlist.js'

describe('formatM3U', () => {
  it('writes an extended M3U with titles', () => {
    expect(
      formatM3U([
        { location: 'Album/01 Song.flac', title: 'Artist - Song' },
        { location: 'C:\\Music\\b.mp3', title: '' },
      ]),
    ).toBe('#EXTM3U\n#EXTINF:-1,Artist - Song\nAlbum/01 Song.flac\nC:\\Music\\b.mp3\n')
  })

  it('strips line breaks from titles and locations', () => {
    expect(formatM3U([{ location: 'a\n.mp3', title: 'Two\nlines', durationSec: 61.4 }])).toBe(
      '#EXTM3U\n#EXTINF:61,Two lines\na.mp3\n',
    )
  })
})

describe('parseM3U', () => {
  it('reads locations, skipping comments, blanks and BOM', () => {
    const text = '\uFEFF#EXTM3U\r\n#EXTINF:-1,X\r\nsong.mp3\r\n\r\n# comment\r\nsub/other.flac\r\n'
    expect(parseM3U(text)).toEqual(['song.mp3', 'sub/other.flac'])
  })

  it('decodes file:// URLs', () => {
    expect(parseM3U('file:///C:/My%20Music/a.mp3\nfile:///home/me/b.ogg')).toEqual([
      'C:/My Music/a.mp3',
      '/home/me/b.ogg',
    ])
  })

  it('round-trips formatM3U output', () => {
    const items = [{ location: 'x.mp3', title: 'A - B' }, { location: 'y.m4a' }]
    expect(parseM3U(formatM3U(items))).toEqual(['x.mp3', 'y.m4a'])
  })
})

describe('playlistTitle', () => {
  it('uses "Artist - Title", then title, then fallback', () => {
    expect(playlistTitle({ artist: 'A', title: 'T' }, 'f.mp3')).toBe('A - T')
    expect(playlistTitle({ title: 'T' }, 'f.mp3')).toBe('T')
    expect(playlistTitle({}, 'f.mp3')).toBe('f.mp3')
  })
})
