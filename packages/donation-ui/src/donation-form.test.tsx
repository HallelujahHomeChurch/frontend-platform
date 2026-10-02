import {cleanup, render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, expect, it} from 'vitest';
import {DonationForm} from './index.js';
import {DonationApiError, type DonationCheckoutInput, type DonationOrder} from '@hallelujahhomechurch/donation-client';

afterEach(() => {cleanup(); sessionStorage.clear()});
const order: DonationOrder = {id: '00000000-0000-4000-8000-000000000001', environment: 'sandbox', currency: 'TWD', amount_minor: 10000, creation_state: 'create_unknown', outcomes: []};

it('locks the submitted amount and preserves the key when a create response is lost', async () => {
  const intents: Array<{input: DonationCheckoutInput; key: string}> = [];
  render(<DonationForm transport={{createCheckout: async (input, key) => {
    intents.push({input, key});
    if (intents.length === 1) throw new TypeError('transport lost');
    return order;
  }}} onOrder={() => {}} />);
  await userEvent.type(screen.getByLabelText('金額（TWD）'), '100.00');
  await userEvent.click(screen.getByRole('button', {name: '建立付款'}));
  expect(await screen.findByRole('alert')).toHaveTextContent('相同付款');
  expect(screen.getByLabelText('金額（TWD）')).toBeDisabled();
  await userEvent.click(screen.getByRole('button', {name: '重試相同付款'}));
  await waitFor(() => expect(intents).toHaveLength(2));
  expect(intents[0].input).toEqual({amount_minor: 10000});
  expect(intents[1]).toEqual(intents[0]);
  expect(screen.getByRole('button', {name: '付款已建立'})).toBeDisabled();
});

it('rejects decimal precision, exponent notation and limits before creating an intent', async () => {
  let calls = 0;
  render(<DonationForm transport={{createCheckout: async () => { calls++; return order; }}} onOrder={() => {}} />);
  const field = screen.getByLabelText('金額（TWD）');
  for (const amount of ['0', '1.001', '1e2', '10000000', '-1']) {
    await userEvent.clear(field);
    await userEvent.type(field, amount);
    await userEvent.click(screen.getByRole('button', {name: '建立付款'}));
    expect(screen.getByRole('alert')).toHaveTextContent('金額');
  }
  expect(calls).toBe(0);
});

it('shows sanitized unavailable feedback without collecting card data', async () => {
  render(<DonationForm transport={{createCheckout: async () => { throw new DonationApiError(503, 'provider_unavailable'); }}} onOrder={() => {}} />);
  await userEvent.type(screen.getByLabelText('金額（TWD）'), '1');
  await userEvent.click(screen.getByRole('button', {name: '建立付款'}));
  expect(await screen.findByRole('alert')).toHaveTextContent('銀行服務暫時無法使用');
  expect(screen.queryByLabelText(/信用卡/)).not.toBeInTheDocument();
});

it('restores the same intent after reload and clears retry metadata after receiving an order', async () => {
  let firstKey = '';
  const first = render(<DonationForm intentStorageKey="actor-intent" transport={{createCheckout: async (_input, key) => {firstKey = key; throw new TypeError('lost response');}}} onOrder={() => {}} />);
  await userEvent.type(screen.getByLabelText('金額（TWD）'), '100');
  await userEvent.click(screen.getByRole('button', {name: '建立付款'}));
  await screen.findByRole('alert');
  expect(JSON.parse(sessionStorage.getItem('actor-intent')!)).toMatchObject({idempotencyKey: firstKey, amountMinor: 10000});
  first.unmount();
  let recovered: unknown;
  render(<DonationForm intentStorageKey="actor-intent" transport={{createCheckout: async (input, key) => {recovered = {input, key}; return order;}}} onOrder={() => {}} />);
  expect(screen.getByLabelText('金額（TWD）')).toBeDisabled();
  await userEvent.click(screen.getByRole('button', {name: '重試相同付款'}));
  await waitFor(() => expect(recovered).toEqual({input: {amount_minor: 10000}, key: firstKey}));
  expect(sessionStorage.getItem('actor-intent')).toBeNull();
});

it('blocks expired or malformed unresolved intent rather than generating another order', async () => {
  let calls = 0;
  for (const value of [JSON.stringify({idempotencyKey: 'stable-intent-0001', amountMinor: 10000, createdAt: Date.now() - 16 * 60000}), '{bad json']) {
    sessionStorage.setItem('actor-intent', value);
    const view = render(<DonationForm intentStorageKey="actor-intent" transport={{createCheckout: async () => {calls++; return order;}}} onOrder={() => {}} />);
    expect(screen.getByRole('alert')).toHaveTextContent('原付款');
    expect(screen.getByRole('button')).toBeDisabled();
    expect(sessionStorage.getItem('actor-intent')).toBe(value);
    view.unmount();
  }
  expect(calls).toBe(0);
});
