import {describe, expect, it} from 'vitest';
import {createSandboxDonationClient, DonationApiError, safeHostedCheckoutUrl} from './index.js';

const order = {id: '00000000-0000-4000-8000-000000000001', environment: 'sandbox', currency: 'TWD', amount_minor: 10000, creation_state: 'create_unknown', outcomes: []};

describe('Sandbox donation transport', () => {
  it('retries an unauthorized create with identical intent through the session runtime', async () => {
    const requests: Request[] = [];
    const client = createSandboxDonationClient({
      getAccessToken: async () => 'old',
      refreshAfterUnauthorized: async (token) => { expect(token).toBe('old'); return 'new'; },
      fetcher: async (input) => {
        const request = input as Request;
        requests.push(request.clone());
        return requests.length === 1 ? Response.json({code: 'unauthorized'}, {status: 401}) : Response.json(order, {status: 202});
      }
    });
    expect(await client.createCheckout({amount_minor: 10000}, 'stable-intent-0001')).toEqual(order);
    expect(requests.map((request) => new URL(request.url).pathname)).toEqual(['/api/admin/donations/sandbox/checkout', '/api/admin/donations/sandbox/checkout']);
    expect(requests.map((request) => request.headers.get('Idempotency-Key'))).toEqual(['stable-intent-0001', 'stable-intent-0001']);
    expect(requests.map((request) => request.headers.get('Authorization'))).toEqual(['Bearer old', 'Bearer new']);
    expect(await requests[1].json()).toEqual({amount_minor: 10000});
  });

  it('does not retry provider errors or expose provider messages', async () => {
    let calls = 0;
    const client = createSandboxDonationClient({getAccessToken: async () => 'token', refreshAfterUnauthorized: async () => null, fetcher: async () => {
      calls++;
      return Response.json({code: 'provider_unavailable', message: 'PayToken=secret'}, {status: 503});
    }});
    await expect(client.createCheckout({amount_minor: 100}, 'stable-intent-0002')).rejects.toMatchObject({status: 503, code: 'provider_unavailable', message: 'Donation request failed'});
    expect(calls).toBe(1);
  });

  it('returns pending without inventing financial facts and avoids cached owner reads', async () => {
    const client = createSandboxDonationClient({getAccessToken: async () => 'token', refreshAfterUnauthorized: async () => null, fetcher: async (input) => {
      const request = input as Request;
      expect(request.cache).toBe('no-store');
      expect(new URL(request.url).pathname).toBe('/api/admin/donations/sandbox/returns/' + 'a'.repeat(64));
      return Response.json({state: 'pending'}, {status: 202});
    }});
    expect(await client.resolveReturn('a'.repeat(64))).toEqual({state: 'pending'});
  });

  it('rejects invalid minor units, injected fields and references before transport', async () => {
    let calls = 0;
    const client = createSandboxDonationClient({getAccessToken: async () => null, refreshAfterUnauthorized: async () => null, fetcher: async () => { calls++; return Response.json(order); }});
    for (const amount of [0, -1, 1.2, NaN, 1000000000]) await expect(client.createCheckout({amount_minor: amount}, 'stable-intent-0003')).rejects.toBeInstanceOf(DonationApiError);
    await expect(client.createCheckout({amount_minor: 100, environment: 'production'} as {amount_minor: number}, 'stable-intent-0003')).rejects.toBeInstanceOf(DonationApiError);
    await expect(client.resolveReturn('../other')).rejects.toBeInstanceOf(DonationApiError);
    expect(calls).toBe(0);
  });
});

it('accepts only the exact HTTPS bank origin without credentials or fragments', () => {
  expect(safeHostedCheckoutUrl('https://funbiz.sinopac.com/pay?opaque=one', 'https://funbiz.sinopac.com')).toBe('https://funbiz.sinopac.com/pay?opaque=one');
  for (const url of ['http://funbiz.sinopac.com/pay', 'https://funbiz.sinopac.com.evil.test/pay', 'https://evil@funbiz.sinopac.com/pay', 'https://funbiz.sinopac.com/pay#token', 'https://funbiz.sinopac.com/pay#', 'javascript:alert(1)', '/pay']) {
    expect(safeHostedCheckoutUrl(url, 'https://funbiz.sinopac.com')).toBeNull();
  }
});
