import { Role } from '@prisma/client';
import { InvitationsService } from './invitations.service';

describe('InvitationsService', () => {
  it('persists the Manager or Editor role selected by the owner', async () => {
    const create = jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'inv-1', ...data }));
    const audit = { log: jest.fn().mockResolvedValue({}) };
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn((callback) =>
        callback({
          invitation: {
            findFirst: jest.fn().mockResolvedValue(null),
            delete: jest.fn(),
            create,
          },
        }),
      ),
      invitation: {
        create: jest.fn(),
      },
    };
    const service = new InvitationsService(prisma as never, audit as never);

    await service.create('org-1', 'owner-1', {
      email: '  Manager@Example.Test ',
      role: Role.MANAGER,
    });

    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: 'manager@example.test',
        role: Role.MANAGER,
        organisationId: 'org-1',
        invitedById: 'owner-1',
      }),
    });
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'INVITATION_CREATED',
        organisationId: 'org-1',
        actorId: 'owner-1',
      }),
      expect.any(Object),
    );
  });

  it('rejects a canonicalized duplicate active invitation', async () => {
    const tx = {
      invitation: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'existing',
          expiresAt: new Date(Date.now() + 60_000),
        }),
        delete: jest.fn(),
        create: jest.fn(),
      },
    };
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn((callback) => callback(tx)),
    };
    const service = new InvitationsService(prisma as never, { log: jest.fn() } as never);

    await expect(
      service.create('org-1', 'owner-1', {
        email: ' Invitee@Example.Test ',
        role: Role.EDITOR,
      }),
    ).rejects.toThrow('An active invitation for this email already exists.');

    expect(tx.invitation.findFirst).toHaveBeenCalledWith({
      where: {
        organisationId: 'org-1',
        email: 'invitee@example.test',
        acceptedAt: null,
      },
    });
    expect(tx.invitation.create).not.toHaveBeenCalled();
  });

  it('returns a safe public invitation projection', async () => {
    const prisma = {
      invitation: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'inv-1',
          email: 'invitee@example.test',
          role: Role.EDITOR,
          token: 'secret-token',
          invitedById: 'admin-1',
          organisationId: 'org-1',
          acceptedAt: null,
          expiresAt: new Date(Date.now() + 60_000),
          organisation: { name: 'Acme' },
        }),
      },
    };
    const service = new InvitationsService(prisma as never, { log: jest.fn() } as never);

    const result = await service.getByToken('secret-token');

    expect(result).toEqual({
      email: 'invitee@example.test',
      role: Role.EDITOR,
      expiresAt: expect.any(Date),
      organisation: { name: 'Acme' },
    });
    expect(result).not.toHaveProperty('token');
    expect(result).not.toHaveProperty('invitedById');
  });

  it('never returns passwordHash when accepting an invitation', async () => {
    const invitation = {
      id: 'inv-1',
      email: 'invitee@example.test',
      role: Role.EDITOR,
      organisationId: 'org-1',
      acceptedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      organisation: { name: 'Acme' },
    };
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: invitation.id }]),
      invitation: {
        findUnique: jest.fn().mockResolvedValue(invitation),
        update: jest.fn().mockResolvedValue({}),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({
          id: 'user-1',
          email: invitation.email,
          name: 'Invitee',
          role: invitation.role,
          organisationId: invitation.organisationId,
          passwordHash: 'must-not-leak',
        }),
      },
    };
    const prisma = {
      invitation: { findUnique: jest.fn().mockResolvedValue(invitation) },
      $transaction: jest.fn((callback) => callback(tx)),
    };
    const service = new InvitationsService(prisma as never, { log: jest.fn() } as never);

    const result = await service.accept('secret-token', { name: 'Invitee', password: 'long-password' });

    expect(result).not.toHaveProperty('passwordHash');
    expect(result).toEqual(expect.objectContaining({ id: 'user-1', email: invitation.email }));
  });
});
