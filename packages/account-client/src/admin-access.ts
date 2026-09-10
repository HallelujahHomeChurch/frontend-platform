import {hasPermission} from './index.js';

export const adminCapabilities = [
  'cms:read', 'campaigns:read', 'users:read', 'rbac:read', 'presenter:line:manage', 'dsr:read'
] as const;
export type AdminCapability = typeof adminCapabilities[number];

// These aliases preserve existing API compatibility; they are not a permission hierarchy.
const legacyPermissions: Readonly<Record<string, string>> = {
  'campaigns:read': 'cms:read',
  'campaigns:write': 'cms:write',
  'campaigns:send': 'cms:write',
  'users:read': 'users:manage',
  'rbac:read': 'rbac:manage',
  'dsr:read': 'dsr:manage',
  'presenter:line:manage': 'media-sync:manage'
};

export function hasAdminCapability(permissions: readonly string[], capability: string): boolean {
  if (hasPermission(permissions, capability)) return true;
  const legacy = legacyPermissions[capability];
  return legacy !== undefined && hasPermission(permissions, legacy);
}

export function canAccessAdmin(permissions: readonly string[]): boolean {
  return adminCapabilities.some(capability => hasAdminCapability(permissions, capability));
}
