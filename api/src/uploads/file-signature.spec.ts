import { DOCUMENT_KINDS, IMAGE_KINDS, detectFileSignature } from './file-signature';

describe('detectFileSignature', () => {
  it('detects a PNG from its magic bytes', () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
    expect(detectFileSignature(png)).toEqual({ kind: 'png', extension: 'png' });
  });

  it('detects a JPEG from its magic bytes', () => {
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]);
    expect(detectFileSignature(jpeg)).toEqual({ kind: 'jpeg', extension: 'jpg' });
  });

  it('detects a PDF from its magic bytes', () => {
    const pdf = Buffer.from('%PDF-1.4 ...', 'ascii');
    expect(detectFileSignature(pdf)).toEqual({ kind: 'pdf', extension: 'pdf' });
  });

  it('returns null for content that matches no known signature', () => {
    const text = Buffer.from('this is definitely not an image or a pdf', 'ascii');
    expect(detectFileSignature(text)).toBeNull();
  });

  it('returns null for an empty buffer', () => {
    expect(detectFileSignature(Buffer.alloc(0))).toBeNull();
  });

  it('rejects an arbitrary ZIP as DOCX', () => {
    expect(detectFileSignature(Buffer.from([0x50, 0x4b, 0x03, 0x04, 0, 0]))).toBeNull();
  });

  it('recognises an OOXML document container', () => {
    const docx = Buffer.concat([
      Buffer.from([0x50, 0x4b, 0x03, 0x04]),
      Buffer.from('...[Content_Types].xml...word/document.xml...', 'ascii'),
    ]);
    expect(detectFileSignature(docx)).toEqual({ kind: 'docx', extension: 'docx' });
  });

  it('does not classify a PDF as an allowed image kind', () => {
    const pdf = Buffer.from('%PDF-1.4', 'ascii');
    const signature = detectFileSignature(pdf);
    expect(signature).not.toBeNull();
    expect(IMAGE_KINDS).not.toContain(signature!.kind);
    expect(DOCUMENT_KINDS).toContain(signature!.kind);
  });
});
