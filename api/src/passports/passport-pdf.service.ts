import { Injectable } from '@nestjs/common';
import PDFDocument = require('pdfkit');
import * as QRCode from 'qrcode';
import { PassportsService } from './passports.service';

interface Snapshot {
  name: string;
  sku: string;
  serialNumber?: string | null;
  description?: string | null;
  productionDate?: string | Date | null;
  category?: { name: string } | null;
  countryOfOrigin?: { name: string } | null;
  organisation?: { name: string; logoUrl?: string | null; accentColor?: string | null };
  materials?: Array<{
    name: string;
    percentage: number;
    recyclable?: boolean;
    countryOfOrigin?: { name: string } | null;
  }>;
  sustainability?: {
    carbonFootprintKg?: number | null;
    waterConsumptionL?: number | null;
    recycledPercent?: number | null;
    repairabilityScore?: number | null;
    recyclable?: boolean;
  } | null;
  certifications?: Array<{
    name: string;
    issuingAuthority?: string | null;
    expiryDate?: string | Date | null;
    fileKey?: string | null;
  }>;
  documents?: Array<{
    type: string;
    fileName: string;
    fileKey: string;
    sizeBytes?: number;
  }>;
  images?: Array<{
    fileKey: string;
    isCover?: boolean;
    altText?: string | null;
  }>;
}

interface RemoteImage {
  buffer: Buffer;
  contentType: string;
}

const PAGE = {
  left: 42,
  right: 553,
  bottom: 66,
  width: 511,
};

const COLORS = {
  ink: '#172B24',
  body: '#34473F',
  muted: '#667A72',
  line: '#DCE5E1',
  soft: '#F4F8F6',
  successSoft: '#ECF8F2',
  success: '#147A5B',
  white: '#FFFFFF',
};

const DOCUMENT_LABELS: Record<string, string> = {
  MANUAL: 'User manual',
  WARRANTY: 'Warranty',
  DATASHEET: 'Technical datasheet',
};

@Injectable()
export class PassportPdfService {
  constructor(private readonly passports: PassportsService) {}

  async generate(uuid: string): Promise<Buffer> {
    const passport = await this.passports.getPublicByUuid(uuid);
    const product = passport.product as unknown as Snapshot;
    const publicUrl = `${process.env.WEB_PUBLIC_URL || 'http://localhost:3001'}/passport/${uuid}`;
    const assetBaseUrl = process.env.PUBLIC_BASE_URL || 'http://localhost:3000';
    const cover = product.images?.find((image) => image.isCover) ?? product.images?.[0];
    const gallery = (product.images ?? []).filter((image) => image.fileKey !== cover?.fileKey).slice(0, 3);

    const [qr, coverImage, logoImage, ...galleryImages] = await Promise.all([
      QRCode.toBuffer(publicUrl, { width: 512, margin: 1 }),
      cover ? this.fetchImage(`${assetBaseUrl}/uploads/${cover.fileKey}`) : Promise.resolve(null),
      product.organisation?.logoUrl ? this.fetchImage(product.organisation.logoUrl) : Promise.resolve(null),
      ...gallery.map((image) => this.fetchImage(`${assetBaseUrl}/uploads/${image.fileKey}`)),
    ]);

    return new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        margin: PAGE.left,
        bufferPages: true,
        info: {
          Title: `${product.name} Digital Product Passport`,
          Subject: `Verified Product Passport ${passport.uuid}`,
          Author: product.organisation?.name || 'Notarify',
        },
      });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const accent = this.safeAccent(product.organisation?.accentColor);
      const softAccent = tintColor(accent, 0.94);
      const softImageBg = tintColor(accent, 0.88);
      const lineAccent = tintColor(accent, 0.82);

      this.brandHeader(doc, product.organisation?.name || 'Notarify', logoImage, accent);
      this.hero(doc, product, coverImage, qr, accent, softAccent, softImageBg);

      this.sectionTitle(doc, 'PRODUCT INFORMATION', accent, lineAccent, 58);
      if (product.description) {
        doc.font('Helvetica').fontSize(10).fillColor(COLORS.body).text(product.description, {
          width: PAGE.width,
          lineGap: 3,
        });
        doc.moveDown(0.9);
      }
      this.infoGrid(doc, [
        ['Category', product.category?.name || '-'],
        ['Production date', this.formatDate(product.productionDate)],
        ['Country of origin', product.countryOfOrigin?.name || '-'],
      ], softAccent);

      if (product.materials?.length) {
        this.sectionTitle(doc, 'MATERIALS', accent, lineAccent, 27);
        this.materialTable(doc, product.materials, accent, softAccent);
      }

      if (product.sustainability) {
        const sustainability = product.sustainability;
        const cards = [
          ['Carbon footprint', this.value(sustainability.carbonFootprintKg, ' kg CO2e')],
          ['Water consumption', this.value(sustainability.waterConsumptionL, ' litres')],
          ['Recycled material', this.value(sustainability.recycledPercent, '%')],
          ['Repairability', this.value(sustainability.repairabilityScore, '/10')],
        ].filter(([, value]) => value !== '-');
        if (cards.length) {
          this.sectionTitle(doc, 'SUSTAINABILITY', accent, lineAccent, 60);
          this.metricCards(doc, cards, accent, softAccent);
          if (sustainability.recyclable) {
            doc.moveDown(0.5).font('Helvetica-Bold').fontSize(9).fillColor(accent).text('RECYCLABLE');
          }
        }
      }

      if (product.certifications?.length) {
        this.sectionTitle(doc, 'CERTIFICATIONS', accent, lineAccent, 49);
        for (const certification of product.certifications) {
          const details = [
            certification.issuingAuthority,
            certification.expiryDate ? `Valid to ${this.formatDate(certification.expiryDate)}` : null,
          ].filter(Boolean).join(' | ');
          const link = certification.fileKey ? `${assetBaseUrl}/uploads/${certification.fileKey}` : undefined;
          this.listCard(doc, certification.name, details || 'Verified certification', link ? 'OPEN PDF' : 'VERIFIED', link, accent, lineAccent);
        }
      }

      if (product.documents?.length) {
        this.sectionTitle(doc, 'DOCUMENTS', accent, lineAccent, 49);
        for (const document of product.documents) {
          const kind = document.fileName.toLowerCase().endsWith('.docx') ? 'DOCX' : 'PDF';
          const detail = document.sizeBytes ? `${kind} | ${this.formatBytes(document.sizeBytes)}` : kind;
          this.listCard(
            doc,
            DOCUMENT_LABELS[document.type] || document.type,
            detail,
            'DOWNLOAD',
            `${assetBaseUrl}/uploads/${document.fileKey}`,
            accent,
            lineAccent,
          );
        }
      }

      const availableGallery = galleryImages.filter((image): image is RemoteImage => Boolean(image));
      if (availableGallery.length) {
        this.sectionTitle(doc, 'GALLERY', accent, lineAccent, 112);
        this.gallery(doc, availableGallery, softAccent);
      }

      this.sectionTitle(doc, 'PASSPORT INFORMATION', accent, lineAccent, 92);
      this.passportPanel(doc, [
        ['Passport ID', passport.uuid],
        ['Creation date', this.formatDate(passport.createdAt)],
        ['Version', `v${passport.version}`],
        ['Status', 'Published'],
        ['Verification', 'Verified'],
      ], accent, softAccent);

      this.ensureSpace(doc, 48);
      doc
        .moveDown(1)
        .font('Helvetica')
        .fontSize(8)
        .fillColor(accent)
        .text(publicUrl, PAGE.left, doc.y, { width: PAGE.width, link: publicUrl, underline: true });

      this.addFooters(doc, passport.uuid, accent, lineAccent);
      doc.end();
    });
  }

  private brandHeader(
    doc: PDFKit.PDFDocument,
    organisationName: string,
    logo: RemoteImage | null,
    accent: string,
  ) {
    const y = doc.y;
    if (logo) {
      try {
        doc.image(logo.buffer, PAGE.left, y, { fit: [22, 22] });
      } catch {
        // An unsupported image format should not prevent passport export.
      }
    }
    const textX = logo ? PAGE.left + 30 : PAGE.left;
    doc.font('Helvetica-Bold').fontSize(10).fillColor(accent).text(organisationName.toUpperCase(), textX, y + 5, {
      width: 320,
      characterSpacing: 0.8,
    });
    doc.font('Helvetica').fontSize(8).fillColor(COLORS.muted).text('DIGITAL PRODUCT PASSPORT', PAGE.right - 170, y + 6, {
      width: 170,
      align: 'right',
      characterSpacing: 0.5,
    });
    doc.y = y + 35;
  }

  private hero(
    doc: PDFKit.PDFDocument,
    product: Snapshot,
    cover: RemoteImage | null,
    qr: Buffer,
    accent: string,
    softAccent: string,
    softImageBg: string,
  ) {
    const y = doc.y;
    const height = 146;
    doc.roundedRect(PAGE.left, y, PAGE.width, height, 12).fill(softAccent);

    const imageX = PAGE.left + 12;
    const imageY = y + 12;
    const imageSize = 122;
    doc.roundedRect(imageX, imageY, imageSize, imageSize, 8).fill(softImageBg);
    if (cover) {
      try {
        doc.image(cover.buffer, imageX, imageY, { fit: [imageSize, imageSize], align: 'center', valign: 'center' });
      } catch {
        this.imagePlaceholder(doc, imageX, imageY, imageSize, accent);
      }
    } else {
      this.imagePlaceholder(doc, imageX, imageY, imageSize, accent);
    }

    const contentX = imageX + imageSize + 16;
    const qrSize = 92;
    const qrX = PAGE.right - qrSize - 12;
    const contentWidth = qrX - contentX - 14;

    doc.roundedRect(contentX, imageY, 92, 20, 10).lineWidth(1).strokeColor(accent).stroke();
    doc.font('Helvetica-Bold').fontSize(8).fillColor(accent).text('VERIFIED', contentX + 9, imageY + 6, {
      width: 74,
      align: 'center',
    });
    doc.font('Helvetica-Bold').fontSize(20).fillColor(COLORS.ink).text(product.name, contentX, imageY + 31, {
      width: contentWidth,
      height: 53,
      ellipsis: true,
    });
    const identity = [product.sku, product.serialNumber].filter(Boolean).join(' | ');
    doc.font('Courier').fontSize(8.5).fillColor(COLORS.muted).text(identity, contentX, imageY + 92, {
      width: contentWidth,
    });

    doc.roundedRect(qrX - 5, imageY - 5, qrSize + 10, qrSize + 25, 8).fill(COLORS.white);
    doc.image(qr, qrX, imageY, { width: qrSize, height: qrSize });
    doc.font('Helvetica-Bold').fontSize(7).fillColor(accent).text('SCAN TO VERIFY', qrX, imageY + qrSize + 7, {
      width: qrSize,
      align: 'center',
    });
    doc.y = y + height + 8;
  }

  private imagePlaceholder(doc: PDFKit.PDFDocument, x: number, y: number, size: number, accent: string) {
    doc.font('Helvetica-Bold').fontSize(8).fillColor(accent).text('PRODUCT', x, y + size / 2 - 4, {
      width: size,
      align: 'center',
      characterSpacing: 1,
    });
  }

  private sectionTitle(doc: PDFKit.PDFDocument, title: string, accent: string, lineAccent: string, followingHeight = 0) {
    this.ensureSpace(doc, 46 + followingHeight);
    doc.moveDown(1.2);
    const y = doc.y;
    doc.rect(PAGE.left, y + 1, 3, 13).fill(accent);
    doc.font('Helvetica-Bold').fontSize(10).fillColor(COLORS.ink).text(title, PAGE.left + 11, y + 2, {
      width: PAGE.width - 11,
      characterSpacing: 0.7,
    });
    doc.moveTo(PAGE.left, y + 23).lineTo(PAGE.right, y + 23).lineWidth(0.7).strokeColor(lineAccent).stroke();
    doc.y = y + 31;
  }

  private infoGrid(doc: PDFKit.PDFDocument, items: Array<[string, string]>, softAccent: string) {
    this.ensureSpace(doc, 58);
    const y = doc.y;
    const gap = 10;
    const width = (PAGE.width - gap * 2) / 3;
    items.forEach(([label, value], index) => {
      const x = PAGE.left + index * (width + gap);
      doc.roundedRect(x, y, width, 48, 7).fill(softAccent);
      doc.font('Helvetica').fontSize(7.5).fillColor(COLORS.muted).text(label.toUpperCase(), x + 10, y + 9, {
        width: width - 20,
        characterSpacing: 0.4,
      });
      doc.font('Helvetica-Bold').fontSize(9).fillColor(COLORS.ink).text(value, x + 10, y + 25, {
        width: width - 20,
        height: 15,
        ellipsis: true,
      });
    });
    doc.y = y + 52;
  }

  private materialTable(
    doc: PDFKit.PDFDocument,
    materials: NonNullable<Snapshot['materials']>,
    accent: string,
    softAccent: string,
  ) {
    const columns = [226, 128, 64, 93];
    this.ensureSpace(doc, 27);
    let y = doc.y;
    doc.roundedRect(PAGE.left, y, PAGE.width, 24, 5).fill(accent);
    ['MATERIAL', 'ORIGIN', 'SHARE', 'CIRCULARITY'].forEach((label, index) => {
      const x = PAGE.left + columns.slice(0, index).reduce((sum, width) => sum + width, 0);
      doc.font('Helvetica-Bold').fontSize(7).fillColor(COLORS.white).text(label, x + 8, y + 8, {
        width: columns[index] - 16,
        align: index >= 2 ? 'right' : 'left',
        characterSpacing: 0.4,
      });
    });
    y += 24;
    doc.y = y;

    materials.forEach((material, index) => {
      this.ensureSpace(doc, 29);
      y = doc.y;
      if (index % 2 === 0) doc.rect(PAGE.left, y, PAGE.width, 27).fill(softAccent);
      const values = [
        material.name,
        material.countryOfOrigin?.name || '-',
        `${material.percentage}%`,
        material.recyclable ? 'Recyclable' : '-',
      ];
      values.forEach((value, column) => {
        const x = PAGE.left + columns.slice(0, column).reduce((sum, width) => sum + width, 0);
        doc.font(column === 0 ? 'Helvetica-Bold' : 'Helvetica').fontSize(8.5)
          .fillColor(column === 3 && material.recyclable ? accent : COLORS.body)
          .text(value, x + 8, y + 9, {
            width: columns[column] - 16,
            align: column >= 2 ? 'right' : 'left',
            height: 12,
            ellipsis: true,
          });
      });
      doc.y = y + 27;
    });
  }

  private metricCards(doc: PDFKit.PDFDocument, cards: string[][], accent: string, softAccent: string) {
    const gap = 10;
    const width = (PAGE.width - gap) / 2;
    for (let index = 0; index < cards.length; index += 2) {
      this.ensureSpace(doc, 60);
      const y = doc.y;
      cards.slice(index, index + 2).forEach(([label, value], localIndex) => {
        const x = PAGE.left + localIndex * (width + gap);
        doc.roundedRect(x, y, width, 52, 8).fill(softAccent);
        doc.font('Helvetica').fontSize(8).fillColor(COLORS.muted).text(label, x + 12, y + 9, {
          width: width - 24,
        });
        doc.font('Helvetica-Bold').fontSize(15).fillColor(accent).text(value, x + 12, y + 25, {
          width: width - 24,
          height: 19,
          ellipsis: true,
        });
      });
      doc.y = y + 60;
    }
  }

  private listCard(
    doc: PDFKit.PDFDocument,
    title: string,
    detail: string,
    action: string,
    link: string | undefined,
    accent: string,
    lineAccent: string,
  ) {
    this.ensureSpace(doc, 49);
    const y = doc.y;
    doc.roundedRect(PAGE.left, y, PAGE.width, 42, 7).lineWidth(0.8).strokeColor(lineAccent).stroke();
    doc.font('Helvetica-Bold').fontSize(9).fillColor(COLORS.ink).text(title, PAGE.left + 12, y + 8, {
      width: 350,
      height: 13,
      ellipsis: true,
    });
    doc.font('Helvetica').fontSize(7.5).fillColor(COLORS.muted).text(detail, PAGE.left + 12, y + 24, {
      width: 350,
      height: 10,
      ellipsis: true,
    });
    doc.font('Helvetica-Bold').fontSize(7.5).fillColor(accent).text(action, PAGE.right - 100, y + 16, {
      width: 88,
      align: 'right',
      link,
      underline: Boolean(link),
    });
    doc.y = y + 49;
  }

  private gallery(doc: PDFKit.PDFDocument, images: RemoteImage[], softAccent: string) {
    this.ensureSpace(doc, 112);
    const gap = 8;
    const width = (PAGE.width - gap * 2) / 3;
    const y = doc.y;
    images.forEach((image, index) => {
      const x = PAGE.left + index * (width + gap);
      doc.roundedRect(x, y, width, 100, 7).fill(softAccent);
      try {
        doc.image(image.buffer, x + 4, y + 4, { fit: [width - 8, 92], align: 'center', valign: 'center' });
      } catch {
        // Skip an unsupported gallery format while preserving the layout.
      }
    });
    doc.y = y + 108;
  }

  private passportPanel(doc: PDFKit.PDFDocument, items: Array<[string, string]>, accent: string, softAccent: string) {
    const height = 92;
    this.ensureSpace(doc, height);
    const panelY = doc.y;
    doc.roundedRect(PAGE.left, panelY, PAGE.width, height, 8).fill(softAccent);

    doc.font('Helvetica').fontSize(7.5).fillColor(COLORS.muted).text('PASSPORT ID', PAGE.left + 12, panelY + 11);
    doc.font('Courier-Bold').fontSize(8.5).fillColor(COLORS.ink).text(items[0][1], PAGE.left + 12, panelY + 25, {
      width: PAGE.width - 24,
    });

    const summary = items.slice(1);
    const width = (PAGE.width - 24) / summary.length;
    summary.forEach(([label, value], index) => {
      const x = PAGE.left + 12 + index * width;
      doc.font('Helvetica').fontSize(7).fillColor(COLORS.muted).text(label.toUpperCase(), x, panelY + 53, {
        width: width - 6,
      });
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor(label === 'Verification' ? accent : COLORS.ink).text(value, x, panelY + 68, {
        width: width - 6,
      });
    });
    doc.y = panelY + height;
  }

  private addFooters(doc: PDFKit.PDFDocument, uuid: string, accent: string, lineAccent: string) {
    const range = doc.bufferedPageRange();
    for (let index = range.start; index < range.start + range.count; index += 1) {
      doc.switchToPage(index);
      // Keep footer text inside PDFKit's printable bottom margin. Positioning
      // it below that boundary makes PDFKit silently append a new blank page.
      const y = doc.page.height - 54;
      doc.moveTo(PAGE.left, y - 8).lineTo(PAGE.right, y - 8).lineWidth(0.6).strokeColor(lineAccent).stroke();
      
      doc.font('Helvetica-Bold').fontSize(7).fillColor(COLORS.ink).text('Powered by Notarify DPP', PAGE.left, y, {
        lineBreak: false,
      });
      doc.font('Helvetica').fontSize(7).fillColor(COLORS.muted).text(` · Passport ${uuid}`, PAGE.left + 90, y, {
        width: 270,
        lineBreak: false,
      });
      doc.font('Helvetica-Bold').fontSize(7).fillColor(accent).text(`PAGE ${index + 1} OF ${range.count}`, PAGE.right - 100, y, {
        width: 100,
        align: 'right',
        lineBreak: false,
      });
    }
  }

  private ensureSpace(doc: PDFKit.PDFDocument, requiredHeight: number) {
    if (doc.y + requiredHeight > doc.page.height - PAGE.bottom) {
      doc.addPage();
      doc.y = PAGE.left;
    }
  }

  private async fetchImage(url: string): Promise<RemoteImage | null> {
    try {
      const response = await fetch(url);
      if (!response.ok) return null;
      const contentType = response.headers.get('content-type')?.split(';')[0] || '';
      if (!['image/png', 'image/jpeg'].includes(contentType)) return null;
      return { buffer: Buffer.from(await response.arrayBuffer()), contentType };
    } catch {
      return null;
    }
  }

  private safeAccent(value: string | null | undefined) {
    return value && /^#[0-9a-f]{6}$/i.test(value) ? value : COLORS.success;
  }

  private formatDate(value: string | Date | null | undefined) {
    return value ? new Date(value).toLocaleDateString('en-GB') : '-';
  }

  private value(value: number | null | undefined, unit: string) {
    return value == null ? '-' : `${value}${unit}`;
  }

  private formatBytes(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}

function tintColor(hex: string, weight = 0.94): string {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return '#F6F7F6';
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  const nr = Math.round(r + (255 - r) * weight);
  const ng = Math.round(g + (255 - g) * weight);
  const nb = Math.round(b + (255 - b) * weight);
  return `#${nr.toString(16).padStart(2, '0')}${ng.toString(16).padStart(2, '0')}${nb.toString(16).padStart(2, '0')}`;
}
