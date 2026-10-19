import createClient from 'openapi-fetch';
import type {components, paths} from './generated.js';
import type {BrowserAccountAuthRuntime} from '@hallelujahhomechurch/account-client';
import type {OperationsAccessSnapshot} from './access.js';

export class OperationsApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly existingRequestId?: string;

  constructor(status: number, code?: string, message = 'Operations request failed', existingRequestId?: string) {
    super(message);
    this.name = 'OperationsApiError';
    this.status = status;
    this.code = code;
    this.existingRequestId = existingRequestId;
  }
}

export interface OperationsClientOptions {
  baseUrl: string;
  getAccessToken: () => Promise<string | null>;
  refreshAfterUnauthorized: (rejectedToken: string) => Promise<string | null>;
  fetcher?: typeof fetch;
  /** Existing host runtime identity fence; required by the new group application methods. */
  auth?: Pick<BrowserAccountAuthRuntime, 'getSnapshot' | 'subscribe'>;
}

export function createOperationsClient(options: OperationsClientOptions) {
  const fetcher = options.fetcher ?? fetch;
  async function send(request: Request, fence?: () => void) {
    const token = await options.getAccessToken();
    fence?.();
    if (fence && !token) throw new OperationsApiError(401, 'unauthorized');
    request = withToken(request, token);
    let response = await fetcher(request.clone());
    fence?.();
    if (response.status !== 401 || !token) return response;

    const refreshed = await options.refreshAfterUnauthorized(token);
    fence?.();
    if (!refreshed) return response;
    response = await fetcher(withToken(request, refreshed));
    fence?.();
    return response;
  }
  const authenticatedFetch: typeof fetch = (input, init) => send(new Request(input, init));
  const raw = createClient<paths>({
    baseUrl: absoluteBaseUrl(options.baseUrl),
    fetch: authenticatedFetch
  });

  async function unwrap<T>(request: Promise<{data?: T; error?: unknown; response: Response}>): Promise<T> {
    const result = await request;
    if (result.error !== undefined || !result.response.ok) throw await apiError(result.response, result.error);
    if (result.data === undefined) throw new OperationsApiError(result.response.status, 'invalid_response');
    return result.data;
  }

  return {
    raw,
    ...groupApplicationMethods(options, send),
    getMyAccess(signal?: AbortSignal): Promise<OperationsAccessSnapshot> {
      // Gateway derives X-HHC-Scopes from the verified token; browsers must not synthesize it.
      return unwrap(raw.GET('/api/operations/me/access', {signal, cache: 'no-store'}));
    }
  };
}

function withToken(request: Request, token: string | null): Request {
  const headers = new Headers(request.headers);
  headers.set('accept', 'application/json');
  if (token) headers.set('authorization', `Bearer ${token}`);
  else headers.delete('authorization');
  return new Request(request, {headers});
}

async function apiError(response: Response, body: unknown): Promise<OperationsApiError> {
  let value = body;
  if (value === undefined) {
    try { value = await response.clone().json(); } catch { value = undefined; }
  }
  const record = typeof value === 'object' && value !== null ? value as Record<string, unknown> : {};
  return new OperationsApiError(
    response.status,
    typeof record.error_code === 'string' ? record.error_code : typeof record.error === 'string' ? record.error : undefined,
    typeof record.message === 'string' ? record.message : undefined,
    response.status === 409 && record.error === 'already_pending' && uuid(record.existingRequestId) ? record.existingRequestId : undefined
  );
}

function absoluteBaseUrl(value: string): string {
  const base = value.replace(/\/$/, '');
  if (/^https?:\/\//.test(base)) return base;
  const origin = globalThis.location?.origin ?? 'http://localhost';
  return new URL(base || '/', origin).toString().replace(/\/$/, '');
}

export type OrgJoinRequest = components['schemas']['OrgJoinRequest'];
export type OrgJoinActions = components['schemas']['OrgJoinActions'];
export type OrgJoinCollapseUnit = components['schemas']['OrgJoinCollapseUnit'];
export type OrgJoinRequestPage = components['schemas']['OrgJoinRequestPage'];
export type ReviewableOrgJoinRequestPage = components['schemas']['ReviewableOrgJoinRequestPage'];
export type DirectoryUnit = components['schemas']['DirectoryUnit'];
export type OrgUnitDirectoryPage = components['schemas']['OrgUnitDirectoryPage'];
export type OrgJoinStatusFilter = OrgJoinRequest['status'] | 'history';
export interface OrgJoinListOptions {status?: OrgJoinStatusFilter; page?: number; limit?: number; signal?: AbortSignal}
export interface OrgUnitDirectoryOptions {relation?: 'mine' | 'all'; q?: string; page?: number; limit?: number; signal?: AbortSignal}
export interface ReviewableOrgJoinListOptions extends OrgJoinListOptions {orgUnitId?: string}
export interface OrgJoinCreateOptions {orgUnitId: string; idempotencyKey: string; signal?: AbortSignal}
export interface OrgJoinMutationOptions {version: number; idempotencyKey: string; signal?: AbortSignal}

const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const shape = (v: unknown, required: string[], optional: string[] = []): v is Record<string, unknown> => record(v) && required.every(k => Object.hasOwn(v, k)) && Object.keys(v).every(k => required.includes(k) || optional.includes(k));
const uuid = (v: unknown): v is string => typeof v === 'string' && /^(?!00000000-0000-0000-0000-000000000000$)[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(v);
const text = (v: unknown): v is string => typeof v === 'string';
const integer = (v: unknown, min = 1): v is number => Number.isSafeInteger(v) && (v as number) >= min;
const oneOf = (v: unknown, values: readonly string[]) => typeof v === 'string' && values.includes(v);
const statuses = ['pending', 'approved', 'rejected', 'cancelled'] as const;
function timestamp(v: unknown): boolean {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(`${v.slice(0, 10)}T00:00:00Z`).toISOString().slice(0, 10) === v.slice(0, 10);
}
function preview(v: unknown): boolean {
  return Array.isArray(v) && v.every(u => shape(u, ['id', 'name', 'kind']) && uuid(u.id) && text(u.name) && oneOf(u.kind, ['church', 'family']));
}
function validJoinRequest(v: unknown): v is OrgJoinRequest {
  return shape(v, ['id', 'orgUnitId', 'orgUnitName', 'orgUnitKind', 'status', 'requestedAt', 'version', 'actions', 'ancestorCollapsePreview'], ['decidedAt', 'cancellationReason', 'applicantDisplayName']) && uuid(v.id) && uuid(v.orgUnitId) && text(v.orgUnitName) && oneOf(v.orgUnitKind, ['small_group', 'fellowship']) && oneOf(v.status, statuses) && timestamp(v.requestedAt) && integer(v.version) && shape(v.actions, ['cancel', 'approve', 'reject']) && Object.values(v.actions).every(a => typeof a === 'boolean') && preview(v.ancestorCollapsePreview) && (v.decidedAt === undefined || timestamp(v.decidedAt)) && (v.applicantDisplayName === undefined || text(v.applicantDisplayName)) && (v.cancellationReason === undefined || oneOf(v.cancellationReason, ['applicant_cancelled', 'membership_ended', 'unit_unavailable', 'church_changed', 'affiliation_changed', 'joined_elsewhere', 'account_unavailable']));
}
function validDirectoryUnit(v: unknown): v is DirectoryUnit {
  return shape(v, ['id', 'name', 'kind', 'ancestorLabels', 'relationship', 'applicationAvailability', 'ancestorCollapsePreview'], ['ownPendingRequestId']) && uuid(v.id) && text(v.name) && oneOf(v.kind, ['church', 'family', 'small_group', 'fellowship']) && Array.isArray(v.ancestorLabels) && v.ancestorLabels.every(text) && oneOf(v.relationship, ['managed', 'joined', 'none']) && oneOf(v.applicationAvailability, ['available', 'already_joined', 'pending', 'affiliation_change_required', 'no_reviewer']) && preview(v.ancestorCollapsePreview) && (v.ownPendingRequestId === undefined || uuid(v.ownPendingRequestId));
}
function validPage(v: unknown, item: (v: unknown) => boolean, reviewer = false): boolean {
  return shape(v, ['items', 'page', ...(reviewer ? ['actionablePendingTotal'] : [])], ['nextPage']) && Array.isArray(v.items) && v.items.length <= 50 && v.items.every(item) && integer(v.page) && (v.nextPage === undefined || integer(v.nextPage, 2)) && (!reviewer || integer(v.actionablePendingTotal, 0));
}
function invalidInput(valid: boolean): asserts valid {if (!valid) throw new OperationsApiError(400, 'invalid_request', 'Invalid group application input');}
function invalidResponse(): never {throw new OperationsApiError(502, 'invalid_response', 'Invalid group application response');}
function mutationHeaders(key: string, version?: number): HeadersInit {
  // A browser Headers value must preserve the exact intent key without trimming or byte conversion.
  invalidInput(typeof key === 'string' && key.trim() === key && /^[\x20-\x7e]{1,200}$/.test(key) && (version === undefined || integer(version)));
  return {'Idempotency-Key': key, ...(version === undefined ? {} : {'If-Match': `"${version}"`})};
}
function query(options: OrgJoinListOptions | OrgUnitDirectoryOptions | ReviewableOrgJoinListOptions, directory = false, reviewer = false): string {
  const allowed = ['page', 'limit', 'signal', ...(directory ? ['relation', 'q'] : ['status']), ...(reviewer ? ['orgUnitId'] : [])];
  invalidInput(record(options) && Object.keys(options).every(k => allowed.includes(k)) && (options.page === undefined || integer(options.page) && options.page <= 10000) && (options.limit === undefined || integer(options.limit) && options.limit <= 50));
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(options)) {
    if (k === 'signal' || v === undefined) continue;
    if (k === 'relation') invalidInput(oneOf(v, ['mine', 'all']));
    if (k === 'q') invalidInput(text(v) && [...v].length <= 100);
    if (k === 'status') invalidInput(oneOf(v, [...statuses, 'history']));
    if (k === 'orgUnitId') invalidInput(uuid(v));
    params.set(k, String(v));
  }
  return params.size ? `?${params}` : '';
}
function groupApplicationMethods(options: OperationsClientOptions, send: (request: Request, fence: () => void) => Promise<Response>) {
  async function request<T>(path: string, validate: (v: unknown) => boolean, signal?: AbortSignal, headers?: HeadersInit, body?: object): Promise<T> {
    const auth = options.auth;
    const actor = () => {const state = auth?.getSnapshot(); return state?.status === 'authenticated' ? state.session.user.id : null;};
    const owner = actor();
    if (!auth || !owner) throw new OperationsApiError(401, 'unauthorized');
    let changed = false;
    const unsubscribe = auth.subscribe(() => {if (actor() !== owner) changed = true;});
    const fence = () => {signal?.throwIfAborted(); if (changed || actor() !== owner) throw new OperationsApiError(401, 'actor_changed');};
    try {
      fence();
      const requestHeaders = new Headers(headers);
      if (body) requestHeaders.set('Content-Type', 'application/json');
      const response = await send(new Request(absoluteBaseUrl(options.baseUrl) + path, {method: body ? 'POST' : 'GET', signal, cache: 'no-store', redirect: 'error', credentials: 'same-origin', headers: requestHeaders, ...(body ? {body: JSON.stringify(body)} : {})}), fence);
      const data: unknown = await response.json().catch(() => undefined);
      fence();
      if (!response.ok) throw await apiError(response, data);
      if (!response.headers.get('Content-Type')?.toLowerCase().includes('application/json') || !validate(data)) return invalidResponse();
      return data as T;
    } finally {unsubscribe();}
  }
  const own = '/api/operations/me/org-join-requests';
  const review = '/api/operations/manage/org-join-requests';
  const detail = (base: string, id: string, signal?: AbortSignal) => {invalidInput(uuid(id)); return request<OrgJoinRequest>(`${base}/${id}`, validJoinRequest, signal);};
  const mutate = (base: string, id: string, input: OrgJoinMutationOptions) => {
    invalidInput(uuid(id) && shape(input, ['version', 'idempotencyKey'], ['signal']) && integer(input.version));
    return request<OrgJoinRequest>(base, validJoinRequest, input.signal, mutationHeaders(input.idempotencyKey, input.version), {});
  };
  return {
    async listOrgUnitDirectory(input: OrgUnitDirectoryOptions = {}): Promise<OrgUnitDirectoryPage> {return request('/api/operations/me/org-units' + query(input, true), v => validPage(v, validDirectoryUnit), input.signal);},
    async listOwnOrgJoinRequests(input: OrgJoinListOptions = {}): Promise<OrgJoinRequestPage> {return request(own + query(input), v => validPage(v, validJoinRequest), input.signal);},
    async listReviewableOrgJoinRequests(input: ReviewableOrgJoinListOptions = {}): Promise<ReviewableOrgJoinRequestPage> {return request(review + query(input, false, true), v => validPage(v, validJoinRequest, true), input.signal);},
    async getOwnOrgJoinRequest(id: string, signal?: AbortSignal): Promise<OrgJoinRequest> {return detail(own, id, signal);},
    async getReviewableOrgJoinRequest(id: string, signal?: AbortSignal): Promise<OrgJoinRequest> {return detail(review, id, signal);},
    async createOrgJoinRequest(input: OrgJoinCreateOptions): Promise<OrgJoinRequest> {
      invalidInput(shape(input, ['orgUnitId', 'idempotencyKey'], ['signal']) && uuid(input.orgUnitId));
      return request(own, validJoinRequest, input.signal, mutationHeaders(input.idempotencyKey), {orgUnitId: input.orgUnitId});
    },
    async cancelOrgJoinRequest(id: string, input: OrgJoinMutationOptions): Promise<OrgJoinRequest> {return mutate(`${own}/${id}/cancel`, id, input);},
    async approveOrgJoinRequest(id: string, input: OrgJoinMutationOptions): Promise<OrgJoinRequest> {return mutate(`${review}/${id}/approve`, id, input);},
    async rejectOrgJoinRequest(id: string, input: OrgJoinMutationOptions): Promise<OrgJoinRequest> {return mutate(`${review}/${id}/reject`, id, input);}
  };
}
