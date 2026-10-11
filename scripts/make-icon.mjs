// Génère l'icône de RunBay (build/icon.png + build/icon.ico) sans aucune dépendance.
// Motif : tuile sombre arrondie + chevron de terminal ">" (accent) + underscore —
// « lancer les outils CLI comme des apps desktop ». Rendu SDF avec suréchantillonnage.
// Usage : node scripts/make-icon.mjs
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'build')

// Palette (identique au design system de l'app)
const FILL = [0x19, 0x1c, 0x20] // tuile
const EDGE = [0x3d, 0x43, 0x4a] // liseré discret
const ACCENT = [0x5f, 0x8f, 0xb8] // --accent
const LIGHT = [0xc9, 0xce, 0xd4] // underscore

// --- SDF de base (coordonnées normalisées 0..1, mises à l'échelle par taille) ---
function sdRoundRect(px, py, cx, cy, w, h, r) {
  const qx = Math.abs(px - cx) - (w / 2 - r)
  const qy = Math.abs(py - cy) - (h / 2 - r)
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r
}
function sdSegment(px, py, ax, ay, bx, by) {
  const abx = bx - ax
  const aby = by - ay
  const t = Math.max(0, Math.min(1, ((px - ax) * abx + (py - ay) * aby) / (abx * abx + aby * aby)))
  return Math.hypot(px - (ax + t * abx), py - (ay + t * aby))
}

// Géométrie du motif (dans un carré 0..1)
const TILE = { cx: 0.5, cy: 0.5, w: 0.94, h: 0.94, r: 0.205 }
const CHEVRON = { a: [0.31, 0.285], b: [0.575, 0.5], c: [0.31, 0.715], t: 0.043 }
const UNDER = { a: [0.435, 0.775], b: [0.695, 0.775], t: 0.038 }

const cov = (d) => Math.max(0, Math.min(1, 0.5 - d / AA)) // couverture anti-aliasée (d en px)
const AA = 1.2 // largeur de l'anti-aliasing en pixels
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t)

/** Rend une image size×size en RGBA. */
function render(size) {
  const s = size / 256 // mise à l'échelle depuis la géométrie de référence
  const rgba = new Uint8Array(size * size * 4)
  const SS = 3 // suréchantillonnage 3×3 par pixel
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const px = (x + (sx + 0.5) / SS) / size
          const py = (y + (sy + 0.5) / SS) / size
          // Tuile + liseré
          const dt = sdRoundRect(px, py, TILE.cx, TILE.cy, TILE.w, TILE.h, TILE.r) * size
          const borderW = 1 - cov(dt + 2.2 * s)
          const tileCol = mix(FILL, EDGE, Math.max(0, borderW))
          const tileA = cov(dt)
          // Chevron (deux capsules jointes)
          const dc =
            Math.min(
              sdSegment(px, py, ...CHEVRON.a, ...CHEVRON.b),
              sdSegment(px, py, ...CHEVRON.b, ...CHEVRON.c)
            ) *
              size -
            CHEVRON.t * size
          const cA = cov(dc)
          // Underscore
          const du = sdSegment(px, py, ...UNDER.a, ...UNDER.b) * size - UNDER.t * size
          const uA = cov(du)
          // Composition "source-over"
          let cr = tileCol[0], cg = tileCol[1], cb = tileCol[2], ca = tileA
          for (const [col, alpha] of [
            [ACCENT, cA],
            [LIGHT, uA]
          ]) {
            const na = alpha + ca * (1 - alpha)
            if (na > 0) {
              cr = (col[0] * alpha + cr * ca * (1 - alpha)) / na
              cg = (col[1] * alpha + cg * ca * (1 - alpha)) / na
              cb = (col[2] * alpha + cb * ca * (1 - alpha)) / na
            }
            ca = na
          }
          r += cr, g += cg, b += cb, a += ca
        }
      }
      const n = SS * SS
      const i = (y * size + x) * 4
      rgba[i] = Math.round(r / n)
      rgba[i + 1] = Math.round(g / n)
      rgba[i + 2] = Math.round(b / n)
      rgba[i + 3] = Math.round(a * 255 / n)
    }
  }
  return rgba
}

// --- Encodage PNG (pur JS, via zlib) ---
const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
function crc32(buf) {
  let c = 0xffffffff
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}
function encodePng(size, rgba) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // profondeur 8 bits
  ihdr[9] = 6 // RGBA
  const raw = Buffer.alloc(size * (size * 4 + 1))
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0 // filtre None
    Buffer.from(rgba.buffer, y * size * 4, size * 4).copy(raw, y * (size * 4 + 1) + 1)
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ])
}

// --- Conteneur ICO (entrées PNG compressées, supporté Vista+) ---
function encodeIco(images) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0) // réservé
  header.writeUInt16LE(1, 2) // type : icône
  header.writeUInt16LE(images.length, 4)
  let offset = 6 + images.length * 16
  const entries = []
  const blobs = []
  for (const { size, png } of images) {
    const e = Buffer.alloc(16)
    e.writeUInt8(size >= 256 ? 0 : size, 0) // largeur (0 = 256)
    e.writeUInt8(size >= 256 ? 0 : size, 1)
    e.writeUInt8(0, 2) // pas de palette
    e.writeUInt8(0, 3)
    e.writeUInt16LE(1, 4) // plans
    e.writeUInt16LE(32, 6) // 32 bits
    e.writeUInt32LE(png.length, 8)
    e.writeUInt32LE(offset, 12)
    entries.push(e)
    blobs.push(png)
    offset += png.length
  }
  return Buffer.concat([header, ...entries, ...blobs])
}

mkdirSync(OUT_DIR, { recursive: true })
const sizes = [16, 24, 32, 48, 64, 128, 256]
const images = sizes.map((size) => ({ size, png: encodePng(size, render(size)) }))
writeFileSync(join(OUT_DIR, 'icon.png'), images.at(-1).png)
writeFileSync(join(OUT_DIR, 'icon.ico'), encodeIco(images))
// Version 64px pour la marque dans la sidebar (nette en HiDPI).
const root = join(OUT_DIR, '..')
writeFileSync(join(root, 'src', 'renderer', 'src', 'assets', 'icon.png'), images.find((im) => im.size === 64).png)
console.log('OK -> build/icon.ico, build/icon.png, src/renderer/src/assets/icon.png')
