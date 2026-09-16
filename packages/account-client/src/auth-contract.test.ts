import {describe, expect, it} from 'vitest';
import {hasPermission, resolveAccountAuth} from './index';

const user = {id: 'u1', email: 'a@example.test', display_name: 'A', avatar_url: null};

describe('authentication authorization seam', () => {
  it('keeps available empty permissions authenticated', async () => {
    await expect(resolveAccountAuth({getSession: async () => ({
      authenticated: true,
      user,
      permissions: [],
      permission_availability: {status: 'available'}
    })})).resolves.toMatchObject({
      status: 'authenticated',
      session: {permissions: [], permissionAvailability: {status: 'available'}}
    });
  });

  it('keeps unavailable permissions authenticated and fail closed', async () => {
    await expect(resolveAccountAuth({getSession: async () => ({
      authenticated: true,
      user,
      permissions: [],
      permission_availability: {
        status: 'unavailable',
        code: 'permission_unavailable',
        request_id: 'req-1',
        retry_at: 2_000
      }
    })})).resolves.toMatchObject({
      status: 'authenticated',
      session: {
        permissions: [],
        permissionAvailability: {
          status: 'unavailable',
          code: 'permission_unavailable',
          requestId: 'req-1',
          retryAt: 2_000
        }
      }
    });
  });

  it('keeps generic permission matching exact except for star', () => {
    expect(hasPermission(['cms:pages:read'], 'cms:pages:read')).toBe(true);
    expect(hasPermission(['cms:*'], 'cms:pages:read')).toBe(false);
    expect(hasPermission(['*'], 'cms:pages:read')).toBe(true);
    expect(hasPermission(['*'], '')).toBe(false);
  });
});
