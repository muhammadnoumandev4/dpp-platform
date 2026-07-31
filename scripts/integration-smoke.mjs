/**
 * Repeatable black-box lifecycle test.
 *
 * Prerequisite: `docker compose up -d` (or run both services locally), then:
 *   npm --prefix api run test:integration
 */
import { writeFile } from 'node:fs/promises';

const baseUrl = process.env.API_URL || 'http://localhost:3000';
const suffix = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
let cookie = '';
let productId;

async function request(path, options = {}, expected = 200) {
  const headers = new Headers(options.headers);
  if (cookie) headers.set('cookie', cookie);
  if (options.body && !(options.body instanceof FormData)) headers.set('content-type', 'application/json');
  const response = await fetch(`${baseUrl}${path}`, { ...options, headers });
  if (response.headers.get('set-cookie')) {
    cookie = response.headers.get('set-cookie').split(';', 1)[0];
  }
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  if (response.status !== expected) {
    throw new Error(`${options.method || 'GET'} ${path}: expected ${expected}, got ${response.status}: ${text}`);
  }
  return body;
}

async function rawRequest(path, options = {}, expected = 200) {
  const headers = new Headers(options.headers);
  if (cookie) headers.set('cookie', cookie);
  const response = await fetch(`${baseUrl}${path}`, { ...options, headers });
  const body = Buffer.from(await response.arrayBuffer());
  if (response.status !== expected) {
    throw new Error(`${options.method || 'GET'} ${path}: expected ${expected}, got ${response.status}`);
  }
  return { response, body };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

try {
  const adminLoginResponse = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'admin@notarify.test', password: 'password123' }),
  });
  assert(adminLoginResponse.status === 200, 'Platform employee login failed.');
  const adminCookie = adminLoginResponse.headers.get('set-cookie')?.split(';', 1)[0];
  assert(adminCookie?.startsWith('dpp_access_token='), 'Employee login did not set the access cookie.');
  const adminOverview = await fetch(`${baseUrl}/platform-admin/overview`, {
    headers: { cookie: adminCookie },
  });
  assert(adminOverview.status === 200, 'Admin cookie could not access platform overview.');
  
  // Create a brand user to attempt unauthorized platform access
  const brandLoginResponse = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'editor@notarify.test', password: 'password123' }),
  });
  const brandCookie = brandLoginResponse.headers.get('set-cookie')?.split(';', 1)[0];
  const brandOverviewAttempt = await fetch(`${baseUrl}/platform-admin/overview`, {
    headers: { cookie: brandCookie },
  });
  assert(brandOverviewAttempt.status === 403, 'Brand user cookie must not access platform overview (403 Forbidden).');

  const login = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'editor@notarify.test', password: 'password123' }),
  });
  assert(login.user && !login.accessToken, 'Login must return a safe user without exposing the JWT.');
  const me = await request('/auth/me');
  assert(me.role === 'OWNER', 'Seeded brand owner /auth/me role is incorrect.');
  await request('/platform-admin/overview', {}, 403);

  const categories = await request('/taxonomy/categories');
  assert(categories.length > 0, 'Seeded category is required.');

  const created = await request('/products', {
    method: 'POST',
    body: JSON.stringify({ name: `Integration product ${suffix}`, sku: `INT-${suffix}` }),
  }, 201);
  productId = created.id;

  await request(`/products/${productId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      categoryId: categories[0].id,
      serialNumber: `SN-${suffix}`,
      productionDate: '2026-07-27',
      materials: [{ name: 'Test material', percentage: 100, recyclable: true }],
      sustainability: { carbonFootprintKg: 1.2, recyclable: true },
    }),
  });
  await request(`/products/${productId}/images`, {
    method: 'POST',
    body: JSON.stringify({
      key: `${me.organisationId}/image/${crypto.randomUUID()}.png`,
      isCover: true,
      altText: 'Integration-test cover',
    }),
  }, 201);

  const searchResult = await request(
    `/products?search=${encodeURIComponent(suffix)}&status=DRAFT&categoryId=${categories[0].id}`,
  );
  assert(searchResult.rows.some((row) => row.id === productId), 'Full-text search/category/status filtering missed the product.');

  const first = await request(`/products/${productId}/publish`, { method: 'POST' }, 201);
  const publicV1 = await request(`/passport/${first.uuid}`, {
    headers: { 'x-scan-id': crypto.randomUUID() },
  });
  assert(publicV1.version === 1, 'First publication must create version 1.');
  assert(publicV1.product.name === created.name, 'Public version 1 snapshot has the wrong name.');
  assert(publicV1.createdAt, 'Public passport must expose its creation date.');
  assert(publicV1.status === 'PUBLISHED', 'Public passport must expose Published status.');
  assert(publicV1.verificationStatus === 'VERIFIED', 'Public passport must expose Verified status.');
  const pdf = await rawRequest(`/passport/${first.uuid}/pdf`);
  assert(pdf.response.headers.get('content-type') === 'application/pdf', 'Passport PDF has the wrong content type.');
  assert(pdf.body.subarray(0, 4).toString('ascii') === '%PDF', 'Passport PDF response is not a PDF file.');
  if (process.env.PDF_OUTPUT) await writeFile(process.env.PDF_OUTPUT, pdf.body);

  const changedName = `Updated integration product ${suffix}`;
  await request(`/products/${productId}`, {
    method: 'PATCH',
    body: JSON.stringify({ name: changedName }),
  });
  const status = await request(`/products/${productId}/publish-status`);
  assert(status.hasUnpublishedChanges === true, 'Draft edit must mark the published product as changed.');
  const stillV1 = await request(`/passport/${first.uuid}`, {
    headers: { 'x-scan-id': crypto.randomUUID() },
  });
  assert(stillV1.product.name === created.name, 'Draft edit leaked into immutable public snapshot.');

  const second = await request(`/products/${productId}/publish`, { method: 'POST' }, 201);
  assert(second.uuid === first.uuid, 'Republish must preserve the passport UUID.');
  const publicV2 = await request(`/passport/${first.uuid}`, {
    headers: { 'x-scan-id': crypto.randomUUID() },
  });
  assert(publicV2.version === 2, 'Republish must increment the immutable version.');
  assert(publicV2.product.name === changedName, 'Republished snapshot did not contain the draft change.');
  const versionHistory = await request(`/products/${productId}/passport-versions`);
  assert(
    versionHistory.length === 2 && versionHistory[0].version === 2 && versionHistory[1].version === 1,
    'Version history must expose both publications newest-first.',
  );
  const historicalV1 = await request(`/products/${productId}/passport-versions/1`);
  assert(historicalV1.uuid === first.uuid, 'Historical versions must retain the stable passport UUID.');
  assert(
    historicalV1.snapshot.name === created.name,
    'Version 1 history was mutated after version 2 was published.',
  );
  const audit = await request('/audit-log?limit=100');
  assert(audit.rows.some((entry) => entry.action === 'PASSPORT_PUBLISHED' && entry.entityId === productId), 'Publish audit entry is missing.');

  const fakeUpload = new FormData();
  fakeUpload.set('purpose', 'image');
  fakeUpload.set('file', new Blob(['not an image'], { type: 'image/png' }), 'fake.png');
  await request('/uploads', { method: 'POST', body: fakeUpload }, 400);

  await request(`/products/${productId}`, { method: 'DELETE' });
  await request(`/products/${productId}`, {}, 404);
  const archivedPassport = await request(`/passport/${first.uuid}`, {
    headers: { 'x-scan-id': crypto.randomUUID() },
  });
  assert(
    archivedPassport.version === 2 && archivedPassport.product.name === changedName,
    'Soft-deleting the authoring record must preserve the last issued passport.',
  );
  await request(`/products/${productId}/unpublish`, { method: 'POST' }, 201);
  await request(`/passport/${first.uuid}`, {}, 404);
  productId = undefined;
  await request('/auth/logout', { method: 'POST' }, 204);

  console.log('Integration smoke passed: employee/brand auth isolation, ranked search/filters, publish v1, PDF, immutable draft, republish v2, inspectable version history, audit, upload rejection, soft-delete preservation, explicit unpublish.');
} finally {
  if (productId && cookie) {
    await request(`/products/${productId}`, { method: 'DELETE' }).catch(() => undefined);
  }
}
