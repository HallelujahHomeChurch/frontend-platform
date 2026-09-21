import {
  authorizedAdminDestinations,
  findAdminDestination,
  type AdminDestination
} from '@hallelujahhomechurch/account-client/admin-access';
import type {components} from './generated.js';

export type OperationsAccessSnapshot = components['schemas']['AccessSnapshot'];

export type OperationsAccessState =
  | {status: 'loading'}
  | {status: 'available'; snapshot: OperationsAccessSnapshot}
  | {status: 'unavailable'};

export type ResolvedAdminAccess =
  | {status: 'loading'}
  | {status: 'unavailable'}
  | {status: 'available'; destinations: AdminDestination[]};

const scopedDestinationByRole = {
  church_membership_manager: 'memberships',
  meeting_manager: 'meetings',
  resource_manager: 'resources',
  reservation_approver: 'reservations'
} as const;

export function resolveAdminAccess(
  staffPermissions: readonly string[],
  operations: OperationsAccessState
): ResolvedAdminAccess {
  const global = authorizedAdminDestinations(staffPermissions);
  if (operations.status !== 'available') {
    return global.length > 0 ? {status: 'available', destinations: global} : operations;
  }

  const destinations = [...global];
  const seen = new Set(destinations.map(({id}) => id));
  if (operations.snapshot.responsibilities.length > 0 && !seen.has('memberships')) {
    const destination = findAdminDestination('memberships');
    if (destination) {
      destinations.push(destination);
      seen.add('memberships');
    }
  }
  for (const {role} of operations.snapshot.orgRoles) {
    const id = scopedDestinationByRole[role as keyof typeof scopedDestinationByRole];
    if (!id || seen.has(id)) continue;
    const destination = findAdminDestination(id);
    if (destination) {
      destinations.push(destination);
      seen.add(id);
    }
  }
  return {status: 'available', destinations};
}
