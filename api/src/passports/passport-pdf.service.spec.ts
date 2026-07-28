import { PassportPdfService } from './passport-pdf.service';

describe('PassportPdfService', () => {
  it('generates a valid PDF from the immutable public snapshot', async () => {
    const passports = {
      getPublicByUuid: jest.fn().mockResolvedValue({
        uuid: 'f7b55d65-ec22-4f56-8617-e4216bb461f5',
        version: 2,
        createdAt: new Date('2026-01-01'),
        product: {
          name: 'Circular Jacket',
          sku: 'CJ-1',
          materials: [{ name: 'Recycled wool', percentage: 100 }],
          sustainability: { carbonFootprintKg: 2.4 },
          certifications: [{ name: 'Global Recycled Standard' }],
        },
      }),
    };
    const service = new PassportPdfService(passports as never);

    const pdf = await service.generate('f7b55d65-ec22-4f56-8617-e4216bb461f5');
    expect(pdf.subarray(0, 4).toString('ascii')).toBe('%PDF');
    expect(pdf.length).toBeGreaterThan(1000);
  });
});
