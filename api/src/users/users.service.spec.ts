import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { UsersService } from './users.service';

function prismaMock() {
  const tx = {
    user: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'user-2',
        organisationId: 'org-1',
        role: 'EDITOR',
      }),
      update: jest.fn().mockResolvedValue({}),
    },
  };
  return {
    tx,
    prisma: {
      $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    },
  };
}

describe('UsersService.remove', () => {
  it('deactivates the account instead of hard deleting its history', async () => {
    const { prisma, tx } = prismaMock();
    const audit = { log: jest.fn().mockResolvedValue({}) };
    const service = new UsersService(prisma as never, audit as never);

    await expect(service.remove('org-1', 'user-2', 'user-1')).resolves.toEqual({ success: true });
    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: 'user-2' },
      data: { disabledAt: expect.any(Date) },
    });
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'USER_DEACTIVATED',
        organisationId: 'org-1',
        actorId: 'user-1',
      }),
      tx,
    );
  });

  it('does not let a user remove their own account', async () => {
    const { prisma } = prismaMock();
    const service = new UsersService(prisma as never, { log: jest.fn() } as never);

    await expect(service.remove('org-1', 'user-1', 'user-1')).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('does not allow the brand owner account to be removed', async () => {
    const { prisma, tx } = prismaMock();
    tx.user.findFirst.mockResolvedValue({
      id: 'owner-1',
      organisationId: 'org-1',
      role: 'OWNER',
    });
    const service = new UsersService(prisma as never, { log: jest.fn() } as never);

    await expect(service.remove('org-1', 'owner-1', 'requester-1')).rejects.toBeInstanceOf(ForbiddenException);
    expect(tx.user.update).not.toHaveBeenCalled();
  });
});
