export * from './oauth.js';
export * from './admin-access.js';
export * from './session-client.js';

import {AccountSessionError, type AccountSessionReader, type AccountSessionUser} from './session-client.js';

export function hasPermission(permissions: readonly string[], required: string): boolean {
  return required.length > 0 && (permissions.includes('*') || permissions.includes(required));
}

export function isPermissionList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(permission => typeof permission === 'string' && permission.length > 0);
}

export type PermissionAvailability =
  | {status: 'available'}
  | {
      status: 'unavailable';
      code: 'permission_unavailable';
      requestId?: string;
      retryAt?: number;
    };

export interface AccountIdentitySession {
  user: AccountSessionUser;
  permissions: readonly string[];
  permissionAvailability: PermissionAvailability;
}

export type AccountAuthResult =
  | {status: 'authenticated'; session: AccountIdentitySession}
  | {status: 'anonymous'}
  | {status: 'unavailable'; error: unknown};

export async function resolveAccountAuth(client: AccountSessionReader): Promise<AccountAuthResult> {
  try {
    const session = await client.getSession();
    return session.authenticated
      ? {
          status: 'authenticated',
          session: {
            user: session.user,
            permissions: session.permissions,
            permissionAvailability: session.permission_availability.status === 'available'
              ? {status: 'available'}
              : {
                  status: 'unavailable',
                  code: 'permission_unavailable',
                  requestId: session.permission_availability.request_id,
                  retryAt: session.permission_availability.retry_at
                }
          }
        }
      : {status: 'anonymous'};
  } catch (error) {
    if (error instanceof AccountSessionError && (error.status === 400 || error.status === 401)) {
      return {status: 'anonymous'};
    }
    return {status: 'unavailable', error};
  }
}

export interface RefreshLockManager {
  request<T>(name: string, callback: () => Promise<T>): Promise<T>;
}

export function createRefreshCoordinator({locks = browserLockManager()}: {locks?: RefreshLockManager} = {}) {
  const requests = new Map<string, Promise<unknown>>();

  return {
    run<T>(key: string, request: () => Promise<T>): Promise<T> {
      const pending = requests.get(key);
      if (pending) return pending as Promise<T>;

      const next = Promise.resolve()
        .then(() => locks ? locks.request(`hhc:refresh:${key}`, request) : request())
        .finally(() => requests.delete(key));
      requests.set(key, next);
      return next;
    }
  };
}

export async function retrySupersededRefresh<T>(request: () => Promise<T>): Promise<T> {
  try {
    return await request();
  } catch (error) {
    if (!isRefreshSuperseded(error)) throw error;
    return request();
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isRefreshSuperseded(error: unknown): boolean {
  return isRecord(error)
    && error.status === 409
    && error.code === 'ACC_AUTH_REFRESH_SUPERSEDED';
}

function browserLockManager(): RefreshLockManager | undefined {
  if (typeof navigator === 'undefined' || !navigator.locks) return undefined;
  return navigator.locks as unknown as RefreshLockManager;
}
