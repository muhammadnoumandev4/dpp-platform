// Minimal magic-byte sniffing so an uploaded file's *actual* content is
// checked, not just its client-supplied filename/mimetype (both are
// attacker-controlled). Covers exactly the types this platform accepts.
export type DetectedFileKind = 'jpeg' | 'png' | 'webp' | 'pdf' | 'docx';

const SIGNATURES: { kind: DetectedFileKind; extension: string; matches: (buf: Buffer) => boolean }[] = [
  { kind: 'jpeg', extension: 'jpg', matches: (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  {
    kind: 'png',
    extension: 'png',
    matches: (b) => b.length > 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  },
  {
    kind: 'webp',
    extension: 'webp',
    matches: (b) => b.length > 12 && b.subarray(0, 4).toString('ascii') === 'RIFF' && b.subarray(8, 12).toString('ascii') === 'WEBP',
  },
  { kind: 'pdf', extension: 'pdf', matches: (b) => b.length > 4 && b.subarray(0, 4).toString('ascii') === '%PDF' },
  {
    kind: 'docx',
    extension: 'docx',
    // OOXML is a ZIP container. Requiring the two canonical entry names
    // rejects arbitrary ZIP files while avoiding trust in filename/MIME data.
    matches: (b) =>
      b.length > 4 &&
      b[0] === 0x50 &&
      b[1] === 0x4b &&
      (b[2] === 0x03 || b[2] === 0x05 || b[2] === 0x07) &&
      b.includes(Buffer.from('[Content_Types].xml')) &&
      b.includes(Buffer.from('word/document.xml')),
  },
];

export function detectFileSignature(buffer: Buffer): { kind: DetectedFileKind; extension: string } | null {
  const match = SIGNATURES.find((sig) => sig.matches(buffer));
  return match ? { kind: match.kind, extension: match.extension } : null;
}

export const IMAGE_KINDS: DetectedFileKind[] = ['jpeg', 'png', 'webp'];
export const DOCUMENT_KINDS: DetectedFileKind[] = ['pdf', 'docx'];
