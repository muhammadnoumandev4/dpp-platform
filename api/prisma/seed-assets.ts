/**
 * Deterministic demo artwork for `prisma/seed.ts`.
 *
 * Seed products need images that read as product photography, not as broken
 * placeholders. Rather than pull in a raster library (or ship binary fixtures),
 * we synthesise a small studio-shot style PNG per product: a gradient sweep
 * backdrop, a rounded product silhouette tinted from a hash of the label, a
 * contact shadow, and the label rendered in a bitmap font.
 *
 * Documents and certificates are generated as real PDFs via pdfkit so that
 * "download" actually opens something in a viewer and reports a plausible size.
 */
import PDFDocument from 'pdfkit';
import { deflateSync } from 'zlib';

// ---------------------------------------------------------------------------
// Minimal PNG encoder (8-bit truecolour, no interlace)
// ---------------------------------------------------------------------------

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c;
  }
  return table;
})();

function crc32(buffer: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buffer.length; i += 1) {
    c = CRC_TABLE[(c ^ buffer[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([length, body, crc]);
}

function encodePng(width: number, height: number, rgb: Buffer): Buffer {
  const stride = width * 3;
  const raw = Buffer.alloc(height * (stride + 1));
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0; // filter type: none
    rgb.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: truecolour
  ihdr[10] = 0; // deflate
  ihdr[11] = 0; // adaptive filtering
  ihdr[12] = 0; // no interlace

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------------------
// 5x7 bitmap font — enough to caption a SKU
// ---------------------------------------------------------------------------

const GLYPHS: Record<string, number[]> = {
  A: [0x0e, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
  B: [0x1e, 0x11, 0x11, 0x1e, 0x11, 0x11, 0x1e],
  C: [0x0e, 0x11, 0x10, 0x10, 0x10, 0x11, 0x0e],
  D: [0x1e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x1e],
  E: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x1f],
  F: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x10],
  G: [0x0e, 0x11, 0x10, 0x17, 0x11, 0x11, 0x0f],
  H: [0x11, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
  I: [0x1f, 0x04, 0x04, 0x04, 0x04, 0x04, 0x1f],
  J: [0x01, 0x01, 0x01, 0x01, 0x11, 0x11, 0x0e],
  K: [0x11, 0x12, 0x14, 0x18, 0x14, 0x12, 0x11],
  L: [0x10, 0x10, 0x10, 0x10, 0x10, 0x10, 0x1f],
  M: [0x11, 0x1b, 0x15, 0x11, 0x11, 0x11, 0x11],
  N: [0x11, 0x19, 0x15, 0x13, 0x11, 0x11, 0x11],
  O: [0x0e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
  P: [0x1e, 0x11, 0x11, 0x1e, 0x10, 0x10, 0x10],
  Q: [0x0e, 0x11, 0x11, 0x11, 0x15, 0x12, 0x0d],
  R: [0x1e, 0x11, 0x11, 0x1e, 0x14, 0x12, 0x11],
  S: [0x0f, 0x10, 0x10, 0x0e, 0x01, 0x01, 0x1e],
  T: [0x1f, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04],
  U: [0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
  V: [0x11, 0x11, 0x11, 0x11, 0x11, 0x0a, 0x04],
  W: [0x11, 0x11, 0x11, 0x15, 0x15, 0x1b, 0x11],
  X: [0x11, 0x11, 0x0a, 0x04, 0x0a, 0x11, 0x11],
  Y: [0x11, 0x11, 0x0a, 0x04, 0x04, 0x04, 0x04],
  Z: [0x1f, 0x01, 0x02, 0x04, 0x08, 0x10, 0x1f],
  '0': [0x0e, 0x11, 0x13, 0x15, 0x19, 0x11, 0x0e],
  '1': [0x04, 0x0c, 0x04, 0x04, 0x04, 0x04, 0x0e],
  '2': [0x0e, 0x11, 0x01, 0x02, 0x04, 0x08, 0x1f],
  '3': [0x1f, 0x02, 0x04, 0x02, 0x01, 0x11, 0x0e],
  '4': [0x02, 0x06, 0x0a, 0x12, 0x1f, 0x02, 0x02],
  '5': [0x1f, 0x10, 0x1e, 0x01, 0x01, 0x11, 0x0e],
  '6': [0x06, 0x08, 0x10, 0x1e, 0x11, 0x11, 0x0e],
  '7': [0x1f, 0x01, 0x02, 0x04, 0x08, 0x08, 0x08],
  '8': [0x0e, 0x11, 0x11, 0x0e, 0x11, 0x11, 0x0e],
  '9': [0x0e, 0x11, 0x11, 0x0f, 0x01, 0x02, 0x0c],
  '-': [0x00, 0x00, 0x00, 0x1f, 0x00, 0x00, 0x00],
  '.': [0x00, 0x00, 0x00, 0x00, 0x00, 0x0c, 0x0c],
  '/': [0x01, 0x02, 0x02, 0x04, 0x08, 0x08, 0x10],
  ' ': [0, 0, 0, 0, 0, 0, 0],
};

const GLYPH_WIDTH = 5;
const GLYPH_HEIGHT = 7;

// ---------------------------------------------------------------------------
// Canvas helpers
// ---------------------------------------------------------------------------

type Rgb = [number, number, number];

class Canvas {
  readonly data: Buffer;

  constructor(readonly width: number, readonly height: number) {
    this.data = Buffer.alloc(width * height * 3);
  }

  /** Blend `color` into the pixel at (x, y) with the given alpha (0..1). */
  blend(x: number, y: number, color: Rgb, alpha = 1): void {
    if (alpha <= 0) return;
    const px = Math.round(x);
    const py = Math.round(y);
    if (px < 0 || py < 0 || px >= this.width || py >= this.height) return;
    const a = Math.min(1, alpha);
    const offset = (py * this.width + px) * 3;
    for (let c = 0; c < 3; c += 1) {
      this.data[offset + c] = Math.round(this.data[offset + c] * (1 - a) + color[c] * a);
    }
  }

  fillRect(x: number, y: number, w: number, h: number, color: Rgb, alpha = 1): void {
    for (let py = y; py < y + h; py += 1) {
      for (let px = x; px < x + w; px += 1) {
        this.blend(px, py, color, alpha);
      }
    }
  }

  toPng(): Buffer {
    return encodePng(this.width, this.height, this.data);
  }
}

function mix(a: Rgb, b: Rgb, t: number): Rgb {
  const clamped = Math.max(0, Math.min(1, t));
  return [
    a[0] + (b[0] - a[0]) * clamped,
    a[1] + (b[1] - a[1]) * clamped,
    a[2] + (b[2] - a[2]) * clamped,
  ];
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function hslToRgb(h: number, s: number, l: number): Rgb {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = (((h % 360) + 360) % 360) / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] =
    hp < 1 ? [c, x, 0]
    : hp < 2 ? [x, c, 0]
    : hp < 3 ? [0, c, x]
    : hp < 4 ? [0, x, c]
    : hp < 5 ? [x, 0, c]
    : [c, 0, x];
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}

/** Signed distance to a rounded rectangle; negative inside. */
function roundedRectDistance(
  px: number,
  py: number,
  cx: number,
  cy: number,
  halfW: number,
  halfH: number,
  radius: number,
): number {
  const dx = Math.abs(px - cx) - (halfW - radius);
  const dy = Math.abs(py - cy) - (halfH - radius);
  const outside = Math.hypot(Math.max(dx, 0), Math.max(dy, 0));
  return outside + Math.min(Math.max(dx, dy), 0) - radius;
}

function drawText(
  canvas: Canvas,
  text: string,
  centerX: number,
  topY: number,
  scale: number,
  color: Rgb,
  alpha = 1,
): void {
  const chars = text.toUpperCase().split('');
  const spacing = scale;
  const totalWidth = chars.length * (GLYPH_WIDTH * scale + spacing) - spacing;
  let cursor = Math.round(centerX - totalWidth / 2);

  for (const char of chars) {
    const glyph = GLYPHS[char] ?? GLYPHS[' '];
    for (let row = 0; row < GLYPH_HEIGHT; row += 1) {
      for (let col = 0; col < GLYPH_WIDTH; col += 1) {
        if ((glyph[row] >> (GLYPH_WIDTH - 1 - col)) & 1) {
          canvas.fillRect(
            cursor + col * scale,
            topY + row * scale,
            scale,
            scale,
            color,
            alpha,
          );
        }
      }
    }
    cursor += GLYPH_WIDTH * scale + spacing;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface ProductImageOptions {
  /** Caption rendered under the silhouette, e.g. the SKU. */
  caption: string;
  /** Varies the silhouette between the cover shot and gallery angles. */
  variant?: number;
  width?: number;
  height?: number;
}

/**
 * Renders a studio-style placeholder product photo as a PNG buffer.
 * Deterministic: the same caption/variant always produces identical bytes,
 * so re-running the seed does not churn upload files.
 */
export function makeProductImagePng(options: ProductImageOptions): Buffer {
  const width = options.width ?? 800;
  const height = options.height ?? 800;
  const variant = options.variant ?? 0;
  const canvas = new Canvas(width, height);

  const seed = hashString(`${options.caption}#${variant}`);
  const hue = seed % 360;
  const productLight: Rgb = hslToRgb(hue, 0.34, 0.62);
  const productDark: Rgb = hslToRgb(hue, 0.42, 0.33);

  // Studio sweep backdrop: cool near-white at the top, warmer grey at the floor.
  const backdropTop: Rgb = [246, 247, 245];
  const backdropBottom: Rgb = [219, 224, 219];
  const horizon = height * 0.72;
  for (let y = 0; y < height; y += 1) {
    const t = y < horizon ? (y / horizon) * 0.75 : 0.75 + ((y - horizon) / (height - horizon)) * 0.25;
    const rowColor = mix(backdropTop, backdropBottom, t);
    for (let x = 0; x < width; x += 1) {
      // Gentle vignette so the frame does not read as flat colour.
      const nx = (x / width - 0.5) * 2;
      const ny = (y / height - 0.5) * 2;
      const vignette = 1 - Math.min(1, Math.hypot(nx, ny) / 1.7) * 0.1;
      canvas.blend(x, y, [rowColor[0] * vignette, rowColor[1] * vignette, rowColor[2] * vignette]);
    }
  }

  const cx = width / 2;
  const cy = height * 0.46;
  const halfW = width * (variant === 0 ? 0.26 : 0.22 + (variant % 3) * 0.02);
  const halfH = height * (variant === 0 ? 0.26 : 0.23 + (variant % 2) * 0.03);
  const radius = Math.min(halfW, halfH) * (variant % 2 === 0 ? 0.38 : 0.62);

  // Contact shadow beneath the silhouette.
  const shadowCy = cy + halfH * 0.98;
  for (let y = Math.floor(shadowCy - halfH * 0.3); y < shadowCy + halfH * 0.3; y += 1) {
    for (let x = Math.floor(cx - halfW * 1.25); x < cx + halfW * 1.25; x += 1) {
      const d = Math.hypot((x - cx) / (halfW * 1.2), (y - shadowCy) / (halfH * 0.22));
      if (d < 1) {
        canvas.blend(x, y, [120, 128, 122], (1 - d) * 0.32);
      }
    }
  }

  // Product silhouette with a soft top-left highlight.
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const d = roundedRectDistance(x, y, cx, cy, halfW, halfH, radius);
      if (d > 1) continue;
      const edgeAlpha = d < 0 ? 1 : 1 - d;
      const shade = (x - (cx - halfW)) / (halfW * 2) * 0.45 + (y - (cy - halfH)) / (halfH * 2) * 0.55;
      const base = mix(productLight, productDark, shade);
      const highlight = Math.max(0, 1 - Math.hypot((x - (cx - halfW * 0.45)) / (halfW * 0.8), (y - (cy - halfH * 0.5)) / (halfH * 0.7)));
      const color = mix(base, [255, 255, 255], highlight * 0.28);
      canvas.blend(x, y, color, edgeAlpha);
    }
  }

  // Band detail so gallery angles differ visibly from the cover.
  if (variant > 0) {
    const bandY = cy + halfH * (variant % 2 === 0 ? 0.35 : -0.3);
    const bandH = Math.max(4, halfH * 0.11);
    for (let y = bandY - bandH / 2; y < bandY + bandH / 2; y += 1) {
      for (let x = cx - halfW; x < cx + halfW; x += 1) {
        if (roundedRectDistance(x, y, cx, cy, halfW, halfH, radius) < 0) {
          canvas.blend(x, y, [255, 255, 255], 0.22);
        }
      }
    }
  }

  const captionScale = Math.max(2, Math.round(width / 170));
  drawText(canvas, options.caption, cx, height * 0.855, captionScale, [82, 92, 86], 0.95);
  drawText(canvas, 'SAMPLE PRODUCT IMAGE', cx, height * 0.915, Math.max(1, Math.round(captionScale * 0.6)), [138, 148, 141], 0.9);

  return canvas.toPng();
}

export interface DemoPdfOptions {
  title: string;
  subtitle: string;
  /** Rendered as a definition list under the heading. */
  rows: [string, string][];
  /** Extra paragraphs so the file has a realistic size and is worth opening. */
  body?: string[];
}

/** Builds a small but genuine, viewer-openable PDF. */
export function makeDemoPdf(options: DemoPdfOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 56 });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fillColor('#0F3D2E').fontSize(22).text(options.title);
    doc.moveDown(0.3);
    doc.fillColor('#5A6B62').fontSize(11).text(options.subtitle);
    doc.moveDown(1.2);

    doc.moveTo(56, doc.y).lineTo(539, doc.y).strokeColor('#D7E2DA').stroke();
    doc.moveDown(1);

    for (const [label, value] of options.rows) {
      doc.fillColor('#5A6B62').fontSize(9).text(label.toUpperCase(), { continued: false });
      doc.fillColor('#111813').fontSize(12).text(value);
      doc.moveDown(0.6);
    }

    if (options.body?.length) {
      doc.moveDown(0.6);
      for (const paragraph of options.body) {
        doc.fillColor('#33413A').fontSize(10.5).text(paragraph, { align: 'left', lineGap: 2 });
        doc.moveDown(0.7);
      }
    }

    doc.moveDown(1.5);
    doc
      .fillColor('#8A948D')
      .fontSize(8.5)
      .text(
        'Demo document generated by the DPP platform seed script. Content is illustrative sample data.',
      );

    doc.end();
  });
}
