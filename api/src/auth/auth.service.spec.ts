import { ConflictException } from '@nestjs/common';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';

describe('AuthService.registerBrand', () => {
  function setup(existingUser: { id: string } | null = null) {
    const organisation = {
      id: 'org-1',
      name: 'North Star',
      publicSlug: 'north-star',
    };
    const user = {
      id: 'user-1',
      organisationId: organisation.id,
      name: 'Ana Admin',
      email: 'ana@example.com',
      passwordHash: 'stored-hash',
      role: Role.OWNER,
      avatarUrl: null,
      language: 'en',
      createdAt: new Date(),
      lastLoginAt: null,
      disabledAt: null,
    };
    const tx = {
      organisation: { create: jest.fn().mockResolvedValue(organisation) },
      category: { createMany: jest.fn().mockResolvedValue({ count: 13 }) },
      country: { createMany: jest.fn().mockResolvedValue({ count: 99 }) },
      materialPreset: { createMany: jest.fn().mockResolvedValue({ count: 25 }) },
      user: { create: jest.fn().mockResolvedValue(user) },
      auditLogEntry: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue(existingUser) },
      organisation: { findUnique: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const jwt = { sign: jest.fn().mockReturnValue('signed-token') };
    return { service: new AuthService(prisma as never, jwt as never), prisma, jwt, tx };
  }

  it('atomically creates an isolated organisation and its brand user', async () => {
    const { service, prisma, jwt, tx } = setup();

    const result = await service.registerBrand({
      brandName: 'North Star',
      name: 'Ana Admin',
      email: 'ANA@EXAMPLE.COM',
      password: 'password123',
    });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.organisation.create).toHaveBeenCalledWith({
      data: { name: 'North Star', publicSlug: 'north-star' },
    });
    expect(tx.category.createMany).toHaveBeenCalledWith(expect.objectContaining({ skipDuplicates: true }));
    expect(tx.country.createMany).toHaveBeenCalledWith(expect.objectContaining({ skipDuplicates: true }));
    expect(tx.materialPreset.createMany).toHaveBeenCalledWith(expect.objectContaining({ skipDuplicates: true }));
    expect(tx.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organisationId: 'org-1',
        name: 'Ana Admin',
        email: 'ana@example.com',
        role: Role.OWNER,
      }),
    });
    const createdPasswordHash = tx.user.create.mock.calls[0][0].data.passwordHash;
    await expect(bcrypt.compare('password123', createdPasswordHash)).resolves.toBe(true);
    expect(tx.auditLogEntry.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organisationId: 'org-1',
        actorId: 'user-1',
        action: 'BRAND_REGISTERED',
      }),
    });
    expect(jwt.sign).toHaveBeenCalledWith({
      sub: 'user-1',
      role: Role.OWNER,
      organisationId: 'org-1',
    });
    expect(result).toEqual({
      accessToken: 'signed-token',
      user: expect.not.objectContaining({ passwordHash: expect.anything() }),
    });
  });

  it('rejects an email that already belongs to another account', async () => {
    const { service, prisma } = setup({ id: 'existing-user' });

    await expect(
      service.registerBrand({
        brandName: 'North Star',
        name: 'Ana Admin',
        email: 'ana@example.com',
        password: 'password123',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
