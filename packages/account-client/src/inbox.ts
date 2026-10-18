import type {BrowserAccountAuthRuntime} from './browser-runtime.js';
import {AccountSessionError} from './session-client.js';

export type InboxLocale = 'zh-Hant' | 'zh-Hans' | 'en' | 'ja' | 'ko';
export type InboxResource =
  | {type: 'org_join_request'; id: string; unitId: string}
  | {type: 'recording'; id: string}
  | {type: 'bulletin'; id: string; series: 'general' | 'children'};
export type InboxAction =
  | {type: 'join_request_review' | 'join_request_result'; resource: Extract<InboxResource, {type: 'org_join_request'}>}
  | {type: 'recording'; resource: Extract<InboxResource, {type: 'recording'}>}
  | {type: 'bulletin'; resource: Extract<InboxResource, {type: 'bulletin'}>; locale: InboxLocale};
export interface InboxProjection {titleKey: string; messageKey: string; parameters: Record<string, string> | null; action?: InboxAction}
export interface InboxItem {id: string; type: string; resource: InboxResource; occurredAt: string; readAt?: string; projection: InboxProjection}
export interface InboxPage {items: InboxItem[]; nextCursor?: string; readSnapshotToken: string; asOf: string}
export interface InboxSummary {items: InboxItem[]; unreadCount: number; readSnapshotToken: string; asOf: string}
export interface InboxListOptions {filter?: 'all' | 'unread'; cursor?: string; limit?: number; locale?: InboxLocale; signal?: AbortSignal}
export interface InboxClientOptions {
  auth: Pick<BrowserAccountAuthRuntime, 'getAccessToken' | 'refreshAfterUnauthorized' | 'getSnapshot' | 'subscribe'>;
  fetcher?: typeof fetch;
}
export type InboxClient = ReturnType<typeof createInboxClient>;

const locales: readonly string[] = ['zh-Hant', 'zh-Hans', 'en', 'ja', 'ko'];
const uuid = (v: unknown): v is string => typeof v === 'string' && /^(?!00000000-0000-0000-0000-000000000000$)[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(v);
const contentId = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(v);
const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const shape = (v: unknown, required: string[], optional: string[] = []): v is Record<string, unknown> => record(v) && required.every(k => Object.hasOwn(v, k)) && Object.keys(v).every(k => required.includes(k) || optional.includes(k));
const token = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 4096 && /^[\x21-\x7e]+$/.test(v);
const timestamp = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(v) && Number.isFinite(Date.parse(v));
const key = (v: unknown): v is string => typeof v === 'string' && /^[a-zA-Z][a-zA-Z0-9_.-]{0,127}$/.test(v);
function invalid(): never {throw new AccountSessionError(502, 'NTF_INVALID_RESPONSE', 'Invalid inbox response');}
function validResource(v: unknown): v is InboxResource {
  if (!record(v)) return false;
  if (v.type === 'org_join_request') return shape(v, ['type', 'id', 'unitId']) && uuid(v.id) && uuid(v.unitId);
  if (v.type === 'recording') return shape(v, ['type', 'id']) && contentId(v.id);
  return v.type === 'bulletin' && shape(v, ['type', 'id', 'series']) && contentId(v.id) && (v.series === 'general' || v.series === 'children');
}
function sameResource(a: InboxResource, b: InboxResource): boolean {
  return a.type === b.type && a.id === b.id && (a.type !== 'bulletin' || b.type === 'bulletin' && a.series === b.series) && (a.type !== 'org_join_request' || b.type === 'org_join_request' && a.unitId === b.unitId);
}
function parseAction(value: unknown, resource: InboxResource): InboxAction | undefined {
  if (!record(value) || typeof value.type !== 'string') return invalid();
  if (!['join_request_review', 'join_request_result', 'recording', 'bulletin'].includes(value.type)) return undefined;
  if (!shape(value, value.type === 'bulletin' ? ['type', 'resource', 'locale'] : ['type', 'resource']) || !validResource(value.resource) || !sameResource(value.resource, resource)) return invalid();
  if (value.type === 'bulletin' ? resource.type !== 'bulletin' || !locales.includes(String(value.locale)) : value.type === 'recording' ? resource.type !== 'recording' : resource.type !== 'org_join_request') return invalid();
  return value as InboxAction;
}
function parseItem(value: unknown): InboxItem {
  if (!shape(value, ['id', 'type', 'resource', 'occurredAt', 'projection'], ['readAt']) || !uuid(value.id) || typeof value.type !== 'string' || !value.type || !validResource(value.resource) || !timestamp(value.occurredAt) || value.readAt !== undefined && !timestamp(value.readAt)) return invalid();
  const p = value.projection;
  if (!shape(p, ['titleKey', 'messageKey', 'parameters'], ['action']) || !key(p.titleKey) || !key(p.messageKey)) return invalid();
  if (p.parameters !== null && (!record(p.parameters) || Object.keys(p.parameters).length > 10 || !Object.entries(p.parameters).every(([k, v]) => key(k) && typeof v === 'string' && new TextEncoder().encode(v).length <= 500 && !/[\0\r]/.test(v)))) return invalid();
  const action = p.action === undefined ? undefined : parseAction(p.action, value.resource);
  return {...value, projection: {titleKey: p.titleKey, messageKey: p.messageKey, parameters: p.parameters as Record<string, string> | null, ...(action ? {action} : {})}} as InboxItem;
}
function parsePage(value: unknown, summary: boolean): InboxPage | InboxSummary {
  if (!shape(value, ['items', 'readSnapshotToken', 'asOf', ...(summary ? ['unreadCount'] : [])], summary ? [] : ['nextCursor']) || !Array.isArray(value.items) || value.items.length > (summary ? 5 : 50) || !token(value.readSnapshotToken) || !timestamp(value.asOf) || value.nextCursor !== undefined && !token(value.nextCursor)) return invalid();
  if (summary && (!Number.isSafeInteger(value.unreadCount) || (value.unreadCount as number) < 0)) return invalid();
  return {...value, items: value.items.map(parseItem)} as unknown as InboxPage | InboxSummary;
}

export function createInboxClient({auth, fetcher = fetch}: InboxClientOptions) {
  const actor = () => {const state = auth.getSnapshot(); return state.status === 'authenticated' ? state.session.user.id : null;};
  async function request(path: string, method: 'GET' | 'POST', signal?: AbortSignal, body?: {snapshotToken: string}): Promise<unknown> {
    const owner = actor();
    if (!owner) throw new AccountSessionError(401, 'NTF_UNAUTHORIZED');
    let changed = false;
    const unsubscribe = auth.subscribe(() => {if (actor() !== owner) changed = true;});
    const fence = () => {
      signal?.throwIfAborted();
      if (changed || actor() !== owner) throw new AccountSessionError(401, 'NTF_ACTOR_CHANGED');
    };
    try {
      let accessToken = await auth.getAccessToken();
      fence();
      if (!accessToken) throw new AccountSessionError(401, 'NTF_UNAUTHORIZED');
      const send = () => fetcher(path, {method, signal, cache: 'no-store', redirect: 'error', credentials: 'same-origin', headers: {Accept: 'application/json', Authorization: `Bearer ${accessToken}`, ...(body ? {'Content-Type': 'application/json'} : {})}, ...(body ? {body: JSON.stringify(body)} : {})});
      let response = await send();
      fence();
      if (response.status === 401) {
        accessToken = await auth.refreshAfterUnauthorized(accessToken);
        fence();
        if (accessToken) response = await send();
        fence();
      }
      if (!response.ok) {
        const payload: unknown = await response.json().catch(() => null);
        fence();
        const code = record(payload) && record(payload.error) && typeof payload.error.code === 'string' ? payload.error.code : 'NTF_REQUEST_FAILED';
        throw new AccountSessionError(response.status, code, 'Inbox request failed', {requestId: record(payload) && record(payload.meta) && typeof payload.meta.requestId === 'string' ? payload.meta.requestId : undefined, retryAfter: response.headers.get('Retry-After') ?? undefined});
      }
      if (!response.headers.get('Content-Type')?.toLowerCase().includes('application/json')) return invalid();
      const envelope: unknown = await response.json().catch(() => invalid());
      fence();
      if (!shape(envelope, ['data', 'meta', 'error']) || envelope.error !== null || !shape(envelope.meta, ['requestId']) || typeof envelope.meta.requestId !== 'string') return invalid();
      return envelope.data;
    } finally {unsubscribe();}
  }
  function input(valid: boolean) {if (!valid) throw new AccountSessionError(400, 'NTF_INVALID_INPUT');}
  return {
    async list({signal, ...options}: InboxListOptions = {}): Promise<InboxPage> {
      input((options.filter === undefined || options.filter === 'all' || options.filter === 'unread') && (options.cursor === undefined || token(options.cursor)) && (options.limit === undefined || Number.isInteger(options.limit) && options.limit >= 1 && options.limit <= 50) && (options.locale === undefined || locales.includes(options.locale)));
      const query = new URLSearchParams();
      if (options.filter !== undefined) query.set('filter', options.filter);
      if (options.cursor !== undefined) query.set('cursor', options.cursor);
      if (options.limit !== undefined) query.set('limit', String(options.limit));
      if (options.locale !== undefined) query.set('locale', options.locale);
      return parsePage(await request('/api/notifications/me' + (query.size ? `?${query}` : ''), 'GET', signal), false) as InboxPage;
    },
    async summary({locale, signal}: {locale?: InboxLocale; signal?: AbortSignal} = {}): Promise<InboxSummary> {
      input(locale === undefined || locales.includes(locale));
      return parsePage(await request('/api/notifications/me/summary' + (locale ? `?locale=${encodeURIComponent(locale)}` : ''), 'GET', signal), true) as InboxSummary;
    },
    async markRead(id: string, signal?: AbortSignal): Promise<{read: true}> {
      input(uuid(id));
      const result = await request(`/api/notifications/me/${id}/read`, 'POST', signal);
      if (!shape(result, ['read']) || result.read !== true) return invalid();
      return {read: true};
    },
    async markAllRead(snapshotToken: string, signal?: AbortSignal): Promise<{read: true}> {
      input(token(snapshotToken));
      const result = await request('/api/notifications/me/read-all', 'POST', signal, {snapshotToken});
      if (!shape(result, ['read']) || result.read !== true) return invalid();
      return {read: true};
    }
  };
}
