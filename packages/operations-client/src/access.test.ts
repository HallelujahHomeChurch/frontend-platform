import {describe, expect, it} from 'vitest';
import {resolveAdminAccess} from './access';

const snapshot = {
  memberships: [],
  entitlements: [],
  version: 'a'.repeat(64),
  orgRoles: []
};

describe('shared Admin access projection', () => {
  it('combines exact global and scoped Operations authority', () => {
    expect(resolveAdminAccess(['cms:bulletins:read'], {
      status: 'available',
      snapshot: {
        ...snapshot,
        orgRoles: [{
          assignmentId: 'a1',
          role: 'meeting_manager',
          orgUnit: {id: 'o1', kind: 'family', name: 'Family'}
        }]
      }
    })).toMatchObject({
      status: 'available',
      destinations: [{id: 'bulletins'}, {id: 'meetings'}]
    });
  });

  it('maps scoped membership leaders only to membership management', () => {
    expect(resolveAdminAccess([], {
      status: 'available',
      snapshot: {
        ...snapshot,
        orgRoles: [{
          assignmentId: 'a1',
          role: 'small_group_leader',
          orgUnit: {id: 'o1', kind: 'small_group', name: 'Group'}
        }]
      }
    })).toMatchObject({
      status: 'available',
      destinations: [{id: 'memberships'}]
    });
  });

  it('never turns pastoral roles into Operations or global destinations', () => {
    expect(resolveAdminAccess([], {
      status: 'available',
      snapshot: {
        ...snapshot,
        orgRoles: [{
          assignmentId: 'a1',
          role: 'pastor',
          orgUnit: {id: 'o1', kind: 'church', name: 'Church'}
        }]
      }
    })).toEqual({status: 'available', destinations: []});
  });

  it('fails only scoped discovery closed when Operations is unavailable', () => {
    expect(resolveAdminAccess([], {status: 'unavailable'})).toEqual({status: 'unavailable'});
    expect(resolveAdminAccess([], {status: 'loading'})).toEqual({status: 'loading'});
    expect(resolveAdminAccess(['audit:read'], {status: 'unavailable'})).toMatchObject({
      status: 'available',
      destinations: [{id: 'audit'}]
    });
  });

  it('does not let unknown roles or removed permissions widen access', () => {
    const available = {
      status: 'available' as const,
      snapshot: {
        ...snapshot,
        orgRoles: [{
          assignmentId: 'a1',
          role: 'future_role' as never,
          orgUnit: {id: 'o1', kind: 'family' as const, name: 'Family'}
        }]
      }
    };
    expect(resolveAdminAccess(['cms:read'], available)).toEqual({status: 'available', destinations: []});
  });

  it('applies star to staff destinations but does not synthesize facts', () => {
    const result = resolveAdminAccess(['*'], {status: 'unavailable'});
    expect(result.status).toBe('available');
    if (result.status === 'available') {
      expect(result.destinations).toContainEqual(expect.objectContaining({id: 'meetings'}));
      expect(result.destinations).toContainEqual(expect.objectContaining({id: 'memberships'}));
    }
  });
});
