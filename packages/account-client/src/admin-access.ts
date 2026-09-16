import {hasPermission} from './index.js';

export const staffPermissionCatalog = [
  '*',
  'users:read', 'users:manage',
  'rbac:read', 'rbac:manage',
  'oauth:read', 'oauth:manage',
  'campaigns:read', 'campaigns:write', 'campaigns:send',
  'assets:read', 'assets:write',
  'presenter:cloud:manage', 'presenter:line:manage',
  'dsr:read', 'dsr:manage',
  'cms:pages:read', 'cms:pages:write', 'cms:pages:publish',
  'cms:news:read', 'cms:news:write', 'cms:news:publish',
  'cms:bulletins:read', 'cms:bulletins:write', 'cms:bulletins:publish', 'cms:bulletins:investigate',
  'operations:meetings:read', 'operations:meetings:write',
  'operations:resources:read', 'operations:resources:write',
  'operations:reservations:read', 'operations:reservations:approve',
  'memberships:read', 'memberships:manage',
  'audit:read'
] as const;

export type StaffPermission = typeof staffPermissionCatalog[number];

export const permissionCompatibilityMap: Readonly<Record<string, never>> = Object.freeze({});

export const adminDestinations = [
  {id: 'page-settings', path: '/content/pages', permission: 'cms:pages:read'},
  {id: 'news', path: '/content/news', permission: 'cms:news:read'},
  {id: 'bulletins', path: '/content/bulletins', permission: 'cms:bulletins:read'},
  {id: 'campaigns', path: '/campaigns', permission: 'campaigns:read'},
  {id: 'meetings', path: '/operations/meetings', permission: 'operations:meetings:read'},
  {id: 'resources', path: '/operations/resources', permission: 'operations:resources:read'},
  {id: 'reservations', path: '/operations/reservations', permission: 'operations:reservations:read'},
  {id: 'memberships', path: '/memberships', permission: 'memberships:read'},
  {id: 'users', path: '/users', permission: 'users:read'},
  {id: 'system-roles', path: '/access', permission: 'rbac:read'},
  {id: 'oauth', path: '/oauth-clients', permission: 'oauth:read'},
  {id: 'audit', path: '/audit', permission: 'audit:read'},
  {id: 'assets', path: '/assets', permission: 'assets:read'},
  {id: 'presenter-cloud', path: '/presenter/cloud', permission: 'presenter:cloud:manage'},
  {id: 'presenter-line', path: '/presenter/line', permission: 'presenter:line:manage'},
  {id: 'dsr', path: '/dsr', permission: 'dsr:read'}
] as const;

export type AdminDestination = typeof adminDestinations[number];
export type AdminDestinationId = AdminDestination['id'];

export function authorizedAdminDestinations(permissions: readonly string[]): AdminDestination[] {
  return adminDestinations.filter(destination => hasPermission(permissions, destination.permission));
}

export function findAdminDestination(id: string): AdminDestination | undefined {
  return adminDestinations.find(destination => destination.id === id);
}

export function firstAuthorizedAdminDestination(permissions: readonly string[]): AdminDestination | undefined {
  return authorizedAdminDestinations(permissions)[0];
}

export function canAccessAdmin(permissions: readonly string[]): boolean {
  return firstAuthorizedAdminDestination(permissions) !== undefined;
}
