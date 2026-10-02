import createClient from 'openapi-fetch';
import type {components, paths} from './generated.js';

export type {components, paths} from './generated.js';
export type DonationOrder = components['schemas']['Order'];
export type DonationCheckoutInput = components['schemas']['CheckoutInput'];
export type DonationReturnResult = DonationOrder | {state: 'pending'};
export type DonationTransport = {
  createCheckout(input: DonationCheckoutInput, idempotencyKey: string, signal?: AbortSignal): Promise<DonationOrder>;
};

export class DonationApiError extends Error {
  constructor(readonly status: number, readonly code: string) {
    super('Donation request failed');
    this.name = 'DonationApiError';
  }
}

export function createSandboxDonationClient(options: {
  getAccessToken: () => Promise<string | null>;
  refreshAfterUnauthorized: (rejectedToken: string) => Promise<string | null>;
  fetcher?: typeof fetch;
}) {
  const fetcher = options.fetcher ?? fetch;
  const raw = createClient<paths>({
    baseUrl: globalThis.location?.origin ?? 'http://localhost',
    fetch: async (input) => {
      const token = await options.getAccessToken();
      if (!token) throw new DonationApiError(401, 'unauthorized');
      const request = new Request(input);
      request.headers.set('Authorization', `Bearer ${token}`);
      request.headers.set('Accept', 'application/json');
      const response = await fetcher(request.clone());
      if (response.status !== 401) return response;
      const refreshed = await options.refreshAfterUnauthorized(token);
      if (!refreshed) return response;
      request.headers.set('Authorization', `Bearer ${refreshed}`);
      return fetcher(request);
    }
  });
  async function unwrap<T>(request: Promise<{data?: T; error?: unknown; response: Response}>): Promise<T> {
    const {data, error, response} = await request;
    if (!response.ok || error !== undefined) {
      const code = typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string' ? error.code : 'request_failed';
      throw new DonationApiError(response.status, code);
    }
    if (data === undefined) throw new DonationApiError(response.status, 'invalid_response');
    return data;
  }
  return {
    async createCheckout(input: DonationCheckoutInput, idempotencyKey: string, signal?: AbortSignal): Promise<DonationOrder> {
      if (Object.keys(input).some((key) => key !== 'amount_minor') || !Number.isSafeInteger(input.amount_minor) || input.amount_minor < 1 || input.amount_minor > 999999999 || !/^[!-~]{16,128}$/.test(idempotencyKey)) throw new DonationApiError(400, 'invalid_input');
      return unwrap(raw.POST('/api/admin/donations/sandbox/checkout', {body: input, params: {header: {'Idempotency-Key': idempotencyKey}}, signal, cache: 'no-store'}));
    },
    async getOrder(orderId: string, signal?: AbortSignal): Promise<DonationOrder> {
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId)) throw new DonationApiError(400, 'invalid_input');
      return unwrap(raw.GET('/api/admin/donations/sandbox/orders/{orderId}', {params: {path: {orderId}}, signal, cache: 'no-store'}));
    },
    async resolveReturn(reference: string, signal?: AbortSignal): Promise<DonationReturnResult> {
      if (!/^[0-9a-f]{64}$/.test(reference)) throw new DonationApiError(400, 'invalid_input');
      return unwrap(raw.GET('/api/admin/donations/sandbox/returns/{reference}', {params: {path: {reference}}, signal, cache: 'no-store'}));
    }
  };
}

export function safeHostedCheckoutUrl(value: string | undefined, allowedOrigin: string): string | null {
  try {
    if (!value) return null;
    const url = new URL(value);
    return url.protocol === 'https:' && url.origin === allowedOrigin && !url.username && !url.password && !value.includes('#') ? url.href : null;
  } catch { return null; }
}
