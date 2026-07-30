import { Role } from '@prisma/client';
import { getPermissions } from './permissions';

describe('permissions', () => {
  it('keeps the team activity history to Owner and Manager', () => {
    expect(getPermissions(Role.OWNER)).toContain('audit.read');
    expect(getPermissions(Role.MANAGER)).toContain('audit.read');
    expect(getPermissions(Role.EDITOR)).not.toContain('audit.read');
    // Platform staff read the cross-tenant trail via platform.read instead.
    expect(getPermissions(Role.ADMIN)).not.toContain('audit.read');
  });

  it('never grants tenant permissions to platform staff', () => {
    expect(getPermissions(Role.ADMIN)).not.toContain('users.manage');
    expect(getPermissions(Role.ADMIN)).not.toContain('products.publish');
  });
});
