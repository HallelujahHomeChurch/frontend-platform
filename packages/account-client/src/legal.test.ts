import { expect, it, vi } from 'vitest';
import { createAccountLegalClient } from './legal.js';

it('keeps confirmation explicit and historical reads owner scoped', async () => {
  const request = vi.fn(async () => []);
  const client = createAccountLegalClient(request);
  await client.history();
  expect(request).toHaveBeenCalledWith('/me/legal/history', { method: 'GET' });
  await expect(client.historyEntry('arbitrary-snapshot')).rejects.toThrow();
  expect(request).toHaveBeenCalledTimes(1);
  await expect(client.confirm('challenge', false)).rejects.toThrow();
  expect(request).toHaveBeenCalledTimes(1);
});
it('treats an unqualified status without a manifest as ordinary access', async () => {
  const client = createAccountLegalClient(async () => ({ required: false }));
  expect(await client.status('en')).toEqual({ required: false });
});
