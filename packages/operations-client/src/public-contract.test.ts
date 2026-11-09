import {describe, expect, it} from 'vitest';
import type {components, paths} from './generated.js';
import {createOperationsClient} from './client.js';

describe('producer public contract', () => {
  it('accepts a privacy-filtered member without email', async () => {
    const member: components['schemas']['ManagedMemberSummary'] = {memberId: 'member', displayName: 'Member'};
    const client = createOperationsClient({baseUrl: '', getAccessToken: async () => 'token', refreshAfterUnauthorized: async () => null,
      fetcher: async () => new Response(JSON.stringify({items: [member], page: 1}), {headers: {'content-type': 'application/json'}})});
    const result = await client.raw.GET('/api/operations/manage/org-units/{unitId}/members', {params: {path: {unitId: 'unit'}}});
    expect(result.data?.items[0]).not.toHaveProperty('email');
  });
  it('exposes admin meeting collection IDs from the new producer and tolerates extra fields', async () => {
    type Meeting = paths['/api/admin/operations/meetings']['get']['responses'][200]['content']['application/json'][number];
    const collections = (meeting: Meeting): string[] => meeting.collectionIds;
    const client = createOperationsClient({baseUrl: '', getAccessToken: async () => 'token', refreshAfterUnauthorized: async () => null,
      fetcher: async () => new Response(JSON.stringify([{id: 'meeting', collectionIds: ['collection'], futureField: true}]), {headers: {'content-type': 'application/json'}})});
    const result = await client.raw.GET('/api/admin/operations/meetings');
    expect(collections(result.data![0])).toEqual(['collection']);
  });
});
