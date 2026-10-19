import type {BulletinReaderMutation} from '../src/client.js'

const common = {mutationId: '49f10a14-688e-4726-b46f-51b68f950128', createdAt: '2026-10-19T00:00:00Z', documentRevision: 1}
const target = {bookmarkId: common.mutationId, sentenceId: 'sentence', offset: 0, pageId: 'page'}
const create: BulletinReaderMutation = {...common, kind: 'createBookmark', payload: {...target, name: 'Bookmark'}}
const rename: BulletinReaderMutation = {...common, kind: 'renameBookmark', baseVersion: 1, payload: {bookmarkId: target.bookmarkId, name: 'New'}}
const remove: BulletinReaderMutation = {...common, kind: 'deleteBookmark', baseVersion: 1, payload: {bookmarkId: target.bookmarkId}}
const reanchor: BulletinReaderMutation = {...common, kind: 'reanchorBookmark', baseVersion: 1, payload: target}
// @ts-expect-error create never accepts a CAS version
const createWithCAS: BulletinReaderMutation = {...common, kind: 'createBookmark', baseVersion: 1, payload: {...target, name: 'Bookmark'}}
// @ts-expect-error rename requires a CAS version
const renameWithoutCAS: BulletinReaderMutation = {...common, kind: 'renameBookmark', payload: {bookmarkId: target.bookmarkId, name: 'New'}}
// @ts-expect-error delete requires a CAS version
const deleteWithoutCAS: BulletinReaderMutation = {...common, kind: 'deleteBookmark', payload: {bookmarkId: target.bookmarkId}}
// @ts-expect-error reanchor requires a CAS version
const reanchorWithoutCAS: BulletinReaderMutation = {...common, kind: 'reanchorBookmark', payload: target}
void [create, rename, remove, reanchor, createWithCAS, renameWithoutCAS, deleteWithoutCAS, reanchorWithoutCAS]
