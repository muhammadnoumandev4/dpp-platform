import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma.service';
import { JwtService } from '@nestjs/jwt';

describe('ProductsController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let authToken: string;
  let organisationId: string;
  let userId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = app.get(PrismaService);
    jwtService = app.get(JwtService);

    // Setup test data
    const org = await prisma.organisation.create({
      data: {
        name: 'E2E Test Org',
        publicSlug: `e2e-org-${Date.now()}`,
      },
    });
    organisationId = org.id;

    const user = await prisma.user.create({
      data: {
        email: `e2e-${Date.now()}@example.com`,
        passwordHash: 'hashed-password',
        name: 'E2E User',
        role: 'OWNER',
        organisationId,
      },
    });
    userId = user.id;

    authToken = jwtService.sign(
      { sub: user.id, email: user.email, organisationId: org.id, role: user.role },
      { 
        secret: process.env.JWT_SECRET || 'supersecret',
        issuer: 'notarify-dpp-platform',
        audience: 'notarify-dpp-platform-clients',
      }
    );
  });

  afterAll(async () => {
    if (organisationId) {
      await prisma.organisation.delete({ where: { id: organisationId } });
    }
    await app.close();
  });

  it('/products (POST) - Create a product', async () => {
    const createDto = {
      name: 'E2E Test Product',
      sku: `E2E-SKU-${Date.now()}`,
    };

    const res = await request(app.getHttpServer())
      .post('/products')
      .set('Authorization', `Bearer ${authToken}`)
      .send(createDto)
      .expect(201);

    expect(res.body).toHaveProperty('id');
    expect(res.body.name).toBe(createDto.name);
    expect(res.body.sku).toBe(createDto.sku);
    expect(res.body.status).toBe('DRAFT');
  });

  it('/products (GET) - List products', async () => {
    const res = await request(app.getHttpServer())
      .get('/products')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(res.body).toHaveProperty('rows');
    expect(Array.isArray(res.body.rows)).toBe(true);
    expect(res.body.rows.length).toBeGreaterThan(0);
    expect(res.body.total).toBeGreaterThan(0);
  });
});
