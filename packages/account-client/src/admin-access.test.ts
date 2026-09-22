import {describe, expect, it} from 'vitest';
import {
  adminDestinations,
  authorizedAdminDestinations,
  canAccessAdmin,
  findAdminDestination,
  firstAuthorizedAdminDestination,
  permissionCompatibilityMap,
  staffPermissionCatalog
} from './admin-access';

describe('Admin destination projection', () => {
  it('keeps the compatibility map explicitly empty', () => {
    expect(permissionCompatibilityMap).toEqual({});
  });

  it('exposes only bulletin navigation to a bulletin viewer', () => {
    expect(authorizedAdminDestinations(['cms:bulletins:read']).map(({id}) => id))
      .toEqual(['bulletins']);
    expect(canAccessAdmin(['cms:bulletins:read'])).toBe(true);
  });

  it('allows an investigator into only the investigation workspace', () => {
    expect(authorizedAdminDestinations(['cms:bulletins:investigate'])).toEqual([
      {id: 'bulletin-investigations', path: '/content/bulletins/investigations', permission: 'cms:bulletins:investigate'}
    ]);
    expect(canAccessAdmin(['cms:bulletins:investigate'])).toBe(true);
  });

  it('does not accept removed broad or legacy permissions', () => {
    for (const permission of [
      'cms:read',
      'cms:write',
      'cms:publish',
      'media-sync:manage',
      'bulletin:read',
      'bulletin:trace',
      'line:main:function:download_weekly_paper:execute'
    ]) {
      expect(authorizedAdminDestinations([permission])).toEqual([]);
    }
  });

  it('uses exact canonical read permissions and star', () => {
    expect(firstAuthorizedAdminDestination(['cms:news:read'])?.id).toBe('news');
    expect(authorizedAdminDestinations(['*'])).toEqual(adminDestinations);
    expect(findAdminDestination('unknown')).toBeUndefined();
    expect(canAccessAdmin([])).toBe(false);
  });

  it('contains the frozen permission catalog without duplicate codes', () => {
    expect(new Set(staffPermissionCatalog).size).toBe(staffPermissionCatalog.length);
    expect(staffPermissionCatalog).toContain('cms:pages:read');
    expect(staffPermissionCatalog).not.toContain('cms:read');
  });
});
