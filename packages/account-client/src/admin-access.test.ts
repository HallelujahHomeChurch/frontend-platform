import {describe, expect, it} from 'vitest';
import {adminCapabilities, canAccessAdmin, hasAdminCapability} from './admin-access';
import {hasPermission} from './index';

describe('Admin access policy', () => {
  it.each(['dsr:read', 'dsr:manage', 'cms:read', 'users:manage', '*'])('admits an accessible module: %s', permission => {
    expect(canAccessAdmin([permission])).toBe(true);
  });
  it.each([[], ['presenter:cloud:manage'], ['presenter:cloud:use'], ['cms:write']])('denies grants with no readable Admin module: %j', (...permissions) => {
    expect(canAccessAdmin(permissions)).toBe(false);
  });
  it('derives entry from the same capabilities used for pages', () => {
    for (const capability of adminCapabilities) {
      expect(hasAdminCapability([capability], capability)).toBe(true);
      expect(canAccessAdmin([capability])).toBe(true);
    }
  });
  it('keeps legacy aliases outside the generic predicate', () => {
    expect(hasPermission(['cms:read'], 'campaigns:read')).toBe(false);
    expect(hasAdminCapability(['cms:read'], 'campaigns:read')).toBe(true);
    expect(hasAdminCapability(['dsr:manage'], 'dsr:read')).toBe(true);
    expect(hasAdminCapability(['media-sync:manage'], 'presenter:line:manage')).toBe(true);
    expect(canAccessAdmin(['presenter:line:manage'])).toBe(true);
    expect(hasPermission(['*'], '')).toBe(false);
    expect(hasPermission(['cms:*'], 'cms:read')).toBe(false);
    expect(hasAdminCapability(['presenter:cloud:use'], 'cms:read')).toBe(false);
  });
});
