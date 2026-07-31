/**
 * QR images are served from the API origin, so a plain `<a download>` is
 * ignored by the browser (the `download` attribute only applies same-origin)
 * and the click navigates away instead. Fetch the bytes and save them from a
 * blob URL so the download works wherever the API is hosted.
 */
export async function downloadQrCode(qrUrl: string, productName: string): Promise<void> {
  const response = await fetch(qrUrl);
  if (!response.ok) throw new Error('QR download failed');

  const blobUrl = URL.createObjectURL(await response.blob());
  const safeName = productName
    .trim()
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();

  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = `${safeName || 'product'}-passport-qr.png`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(blobUrl);
}
