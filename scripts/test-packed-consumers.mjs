import {copyFileSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync, mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {basename, resolve} from 'node:path';
import {spawnSync} from 'node:child_process';

const root = resolve(import.meta.dirname, '..');
const artifacts = resolve(root, 'artifacts');
const temp = mkdtempSync(resolve(tmpdir(), 'hhc-package-smoke-'));
const {version} = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
const bulletinFixture = JSON.parse(readFileSync(resolve(root, 'scripts/testdata/bulletin/1739-typography.json'), 'utf8'));
const bulletinModule = `import {BULLETIN_RENDERER_V1_DIGEST, BULLETIN_RENDERER_V6_DIGEST, getBulletinRendererCapabilities, type BulletinRendererCapabilities, type BulletinDocument} from '@hallelujahhomechurch/ui';
export const capabilities: Readonly<BulletinRendererCapabilities> = getBulletinRendererCapabilities('v10');
if (!capabilities.usesTemplateSnapshot || capabilities.fontFamily !== 'v7') throw new Error('renderer_capabilities');
export const bulletin = ${JSON.stringify(bulletinFixture.document)} as BulletinDocument;
bulletin.layoutManifest.rendererArtifactSha256 = BULLETIN_RENDERER_V1_DIGEST;
export const bulletinV6 = structuredClone(bulletin);
bulletinV6.layoutManifest.rendererVersion = 'v6';
bulletinV6.layoutManifest.rendererArtifactSha256 = BULLETIN_RENDERER_V6_DIGEST;
`;
const tarballs = Object.fromEntries(
  readdirSync(artifacts)
    .filter((file) => file.startsWith('hallelujahhomechurch-') && file.endsWith('-' + version + '.tgz'))
    .map((file) => {
      const name = file.slice('hallelujahhomechurch-'.length, -('-' + version + '.tgz').length);
      const path = resolve(temp, name + '.tgz');
      // Keep file references short enough for pnpm's encoded store filenames.
      copyFileSync(resolve(artifacts, file), path);
      return [name, path];
    })
);

for (const name of ['preferences', 'account-client', 'hhc-web-client', 'operations-client', 'ui', 'donation-client', 'donation-ui']) {
  if (!tarballs[name]) throw new Error(`Missing package tarball: ${name}`);
}

const packageDependencies = Object.fromEntries(
  Object.entries(tarballs).map(([name, path]) => [
    `@hallelujahhomechurch/${name}`,
    `file:${path}`
  ])
);

function write(path, contents) {
  mkdirSync(resolve(path, '..'), {recursive: true});
  writeFileSync(path, contents);
}

function run(directory, ...args) {
  const result = spawnSync('corepack', ['pnpm', ...args], {
    cwd: directory,
    stdio: 'inherit'
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

try {
  const vite = resolve(temp, 'vite');
  write(resolve(vite, 'package.json'), JSON.stringify({
    private: true,
    type: 'module',
    packageManager: 'pnpm@10.12.1',
    scripts: {build: 'vite build'},
    dependencies: {
      ...packageDependencies,
      '@vitejs/plugin-react': '6.0.3',
      react: '19.2.7',
      'react-dom': '19.2.7',
      vite: '8.1.4'
    },
    devDependencies: {},
    pnpm: {overrides: packageDependencies}
  }, null, 2));
  write(resolve(vite, 'index.html'), '<main id="root"></main><script type="module" src="/src/main.tsx"></script>');
  write(resolve(vite, 'vite.config.ts'), "import react from '@vitejs/plugin-react';\nimport {defineConfig} from 'vite';\nexport default defineConfig({plugins: [react()]});\n");
  write(resolve(vite, 'src/bulletin.ts'), bulletinModule);
  write(resolve(vite, 'src/main.tsx'), `import React from 'react';
import {createRoot} from 'react-dom/client';
import {createAccountSessionClient, createBrowserAccountAuthRuntime, createAccountDataRequestsClient, createInboxClient, type InboxAction, type InboxResource, type InboxSummary, type AccountSessionUser, type EmailReauthView, type EmailCorrectionSubmitInput, type EmailCorrectionRequest, type EmailCorrectionErrorCode} from '@hallelujahhomechurch/account-client';
import {canAccessAdmin} from '@hallelujahhomechurch/account-client/admin-access';
import {createHhcWebClient, type ContentStatus, type PageGroupManifest, type BroadcastStreamKey, type BroadcastStreamKeySetInput, type BroadcastStreamKeyBindInput, type BroadcastMutationResult, type BroadcastSource, type BroadcastSourceStreamKeyInput, type BroadcastSourceTargetInput, type BroadcastSourceResolveInput, type BroadcastSourceResolved, type BroadcastSourceBindInput} from '@hallelujahhomechurch/hhc-web-client';
import {createOperationsClient, type ManagedMemberView, type ManagedUnitFolder, type OrgJoinRequest, type OrgUnitDirectoryPage, type ReviewableOrgJoinRequestPage} from '@hallelujahhomechurch/operations-client';
import {getInitialTheme, readAnonymousStatementDismissal, writeAnonymousStatementDismissal, statementRefKey} from '@hallelujahhomechurch/preferences';
import {AccountMenu, Button, ContextMenu, BulletinDocumentRenderer, ExpandableSearchField, NotificationBell, NotificationList, type NotificationAppHref} from '@hallelujahhomechurch/ui';
import {createRef} from 'react';
import {HlsPlayer, type PlayerLabels} from '@hallelujahhomechurch/ui/player';
import '@hallelujahhomechurch/ui/player.css';
import {createSandboxDonationClient} from '@hallelujahhomechurch/donation-client';
import {DonationForm} from '@hallelujahhomechurch/donation-ui';
import '@hallelujahhomechurch/ui/styles.css';
import '@hallelujahhomechurch/ui/bulletin-paper.css';
import {bulletin, bulletinV6} from './bulletin';

const playerLabels: PlayerLabels = {quality:'quality',auto:'auto',play:'play',pause:'pause',mute:'mute',unmute:'unmute',seek:'seek',volume:'volume',fullscreen:'fullscreen',exitFullscreen:'exitFullscreen',fullscreenError:'fullscreenError',playbackSpeed:'playbackSpeed',settings:'settings',togglePlayback:'togglePlayback',privateCopy:'privateCopy',buffering:'buffering'};
const player = <HlsPlayer playbackUrl="https://media.example.test/live/master.m3u8" availableQualities={['720p']} title="Preview" labels={playerLabels} videoRef={createRef<HTMLVideoElement>()} muted onError={() => {}} playbackMode="live" live={{verifiedEnd:120,canFollow:true,label:'Live',backToLive:'Back to live'}} />;
const accountUser: AccountSessionUser = {id: 'u1', email: 'ada@example.com', display_name: 'Ada', avatar_url: null};
const accountSessionClient = createAccountSessionClient();
const authRuntime = createBrowserAccountAuthRuntime({client: accountSessionClient});

const inboxClient = createInboxClient({auth: authRuntime});
async function checkInbox(action: InboxAction, resource: InboxResource) {
  const summary: InboxSummary = await inboxClient.summary({locale: 'en'});
  await inboxClient.list({filter: 'unread', limit: 20, locale: 'en'});
  await inboxClient.markRead('00000000-0000-4000-8000-000000000001');
  await inboxClient.markAllRead(summary.readSnapshotToken);
  if (action.type === 'bulletin') {const locale: 'zh-Hant' | 'zh-Hans' | 'en' | 'ja' | 'ko' = action.locale; void locale;}
  return resource;
}
void checkInbox;
const notificationLabels = {title:'Notifications', loading:'Loading', empty:'Empty', retry:'Retry', markRead:'Mark read', markAllRead:'Mark all read', unread:'Unread', read:'Read', viewAll:'View all', count:(n:number|null) => n === null ? 'Unknown' : String(n)};
const notificationHref: NotificationAppHref = '/en/notifications';
// @ts-expect-error Only known app destinations can be notification links.
const unsafeNotificationHref: NotificationAppHref = 'https://example.test';
void unsafeNotificationHref;
const notificationPresentation = <><NotificationBell labels={notificationLabels} unreadCount={123} isOpen={false} onOpenChange={() => {}} state={{status:'ready',items:[]}} viewAllLink={{href:notificationHref,label:'View all'}} /><NotificationList labels={notificationLabels} state={{status:'error',message:'Unavailable'}} onRetry={() => {}} /></>;

const dataRequests = createAccountDataRequestsClient(async () => {throw new Error('No network in consumer type check');});
async function checkEmailCorrection(intent: EmailReauthView, result: EmailCorrectionRequest, code: EmailCorrectionErrorCode) {
  if (intent.status === 'ready') {
    const input: EmailCorrectionSubmitInput = {kind: intent.kind, newEmail: intent.newEmail, proof: intent.proof, submissionNonce: intent.submissionNonce};
    await dataRequests.submit(input);
    await dataRequests.submission(input.submissionNonce);
  }
  await accountSessionClient.dataRequests.approve(result.id, {requestVersion: result.requestVersion});
  if (code === 'ACC_CORRECTION_NOT_FOUND') return;
}
void checkEmailCorrection;

const operationsClient = createOperationsClient({baseUrl: '', getAccessToken: authRuntime.getAccessToken, refreshAfterUnauthorized: authRuntime.refreshAfterUnauthorized});
const donationClient = createSandboxDonationClient({getAccessToken: authRuntime.getAccessToken, refreshAfterUnauthorized: authRuntime.refreshAfterUnauthorized});
const donationForm = <DonationForm transport={donationClient} onOrder={() => {}} />;
void donationForm;
async function checkUnitManagement(folder: ManagedUnitFolder, member: ManagedMemberView) {
  await operationsClient.raw.GET('/api/operations/manage/roots');
  await operationsClient.raw.GET('/api/operations/manage/org-units/{unitId}', {params: {path: {unitId: folder.unit.id}}});
  await operationsClient.raw.GET('/api/operations/manage/org-units/{unitId}/account-candidates', {params: {path: {unitId: folder.unit.id}, query: {q: '王小'}}});
  await operationsClient.raw.POST('/api/operations/manage/org-units/{unitId}/members', {params: {path: {unitId: folder.unit.id}, header: {'Idempotency-Key': 'admit'}}, body: {accountUserId: '00000000-0000-4000-8000-000000000001'}});
  await operationsClient.raw.POST('/api/operations/manage/org-units/{unitId}/entitlements/batch', {params: {path: {unitId: folder.unit.id}, header: {'Idempotency-Key': 'grant'}}, body: {memberIds: [member.memberId], entitlementCode: 'bulletin.general.zh-Hant.access', operation: 'grant'}});
}
void checkUnitManagement;
const groupClient = createOperationsClient({baseUrl: '', auth: authRuntime, getAccessToken: authRuntime.getAccessToken, refreshAfterUnauthorized: authRuntime.refreshAfterUnauthorized});
async function checkGroupApplications(id: string) {
  const directory: OrgUnitDirectoryPage = await groupClient.listOrgUnitDirectory({relation: 'all', q: 'group', limit: 20});
  const review: ReviewableOrgJoinRequestPage = await groupClient.listReviewableOrgJoinRequests({status: 'history', orgUnitId: id});
  const own = await groupClient.listOwnOrgJoinRequests({status: 'pending'});
  const created: OrgJoinRequest = await groupClient.createOrgJoinRequest({orgUnitId: id, idempotencyKey: 'create'});
  await groupClient.getOwnOrgJoinRequest(created.id);
  await groupClient.getReviewableOrgJoinRequest(created.id);
  await groupClient.cancelOrgJoinRequest(created.id, {version: created.version, idempotencyKey: 'cancel'});
  await groupClient.approveOrgJoinRequest(created.id, {version: created.version, idempotencyKey: 'approve'});
  await groupClient.rejectOrgJoinRequest(created.id, {version: created.version, idempotencyKey: 'reject'});
  // @ts-expect-error History is a list filter, never a resource status.
  const invalidStatus: OrgJoinRequest['status'] = 'history';
  void invalidStatus;
  return {directory, review, own};
}
void checkGroupApplications;
const statementRef = {statementId: '00000000-0000-4000-8000-000000000001', publishedVersion: 7};
void readAnonymousStatementDismissal(statementRef); void writeAnonymousStatementDismissal(statementRef); void statementRefKey(statementRef);
const statementClient = createHhcWebClient({baseUrl: '/api', getAccessToken: authRuntime.getAccessToken, refreshAfterUnauthorized: authRuntime.refreshAfterUnauthorized});
void statementClient.getStatementDismissal(statementRef); void statementClient.dismissStatement(statementRef);
const contentStatus: ContentStatus = 'pending_removal';
const groupManifest: PageGroupManifest = {pageId: '00000000-0000-0000-0000-000000000001', pageSourceVersion: 1, pageTargetVersion: 2, childModule: 'history', items: [], sha256: 'a'.repeat(64)};
void createAccountSessionClient;
void canAccessAdmin;
void operationsClient;
authRuntime.dispose();
async function checkBroadcastStreamKey(id: string, input: BroadcastStreamKeySetInput, binding: BroadcastStreamKeyBindInput) {
  const metadata: BroadcastStreamKey = await statementClient.getBroadcastStreamKey(id);
  const updated: BroadcastStreamKey = await statementClient.setBroadcastStreamKey(id, input);
  const result: BroadcastMutationResult = await statementClient.bindBroadcastStreamKey(id, binding);
  return {metadata, updated, result};
}
void checkBroadcastStreamKey;
async function checkBroadcastSource(key: BroadcastSourceStreamKeyInput, target: BroadcastSourceTargetInput, credential: BroadcastSourceResolveInput, binding: BroadcastSourceBindInput) {
  const metadata: BroadcastSource = await statementClient.getBroadcastSource();
  const updated: BroadcastSource = await statementClient.setBroadcastSourceStreamKey(key);
  const prepared: BroadcastSource = await statementClient.setBroadcastSourceTarget(target);
  const resolved: BroadcastSourceResolved = await statementClient.resolveBroadcastSource(credential);
  const result: BroadcastMutationResult = await statementClient.bindBroadcastSource(binding);
  return {metadata, updated, prepared, resolved, result};
}
void checkBroadcastSource;
void createHhcWebClient;
void contentStatus;
void groupManifest;
void getInitialTheme;
createRoot(document.getElementById('root')!).render(<>{notificationPresentation}{player}<BulletinDocumentRenderer document={bulletin} mode="mobile" /><BulletinDocumentRenderer document={bulletinV6} mode="paper" activePage={bulletinV6.pages[0].id} /><Button>Smoke</Button><ExpandableSearchField label="Search" submitLabel="Submit" clearLabel="Clear" closeLabel="Close" allowEmptySubmit onExpandedChange={() => {}} /><ContextMenu label="Actions" x={0} y={0} isOpen={false} items={[]} onAction={() => {}} onOpenChange={() => {}} /><AccountMenu user={{name: accountUser.display_name, email: accountUser.email}} links={[{id: 'destination', label: 'Destination', href: 'https://example.com/destination'}]} labels={{menu: 'Account', greeting: 'Hi Ada', signOut: 'Sign out'}} onSignOut={() => {}} /></>);
`);
  run(vite, 'install', '--ignore-workspace');
  run(vite, 'exec', 'node', '--input-type=module', '--eval', `
    const account = await import('@hallelujahhomechurch/account-client');
    if (typeof account.createInboxClient !== 'function') throw new Error('missing inbox client');
    await import('@hallelujahhomechurch/hhc-web-client');
    await import('@hallelujahhomechurch/preferences');
    await import('@hallelujahhomechurch/donation-client');
    await import('@hallelujahhomechurch/donation-ui');
    const player = await import('@hallelujahhomechurch/ui/player');
    if (typeof player.HlsPlayer !== 'function' || player.playerClock(65) !== '1:05' || player.liveWindow({length: 1, start: () => 0, end: () => 120}, 120)?.edge !== 30) throw new Error('invalid player ESM entry');
    const ui = await import('@hallelujahhomechurch/ui');
    if (typeof ui.NotificationBell !== 'function' || typeof ui.NotificationList !== 'function') throw new Error('missing notification presentation');
    if (!/^[0-9a-f]{64}$/.test(ui.BULLETIN_RENDERER_V6_DIGEST)) throw new Error('missing V6 renderer');
    ui.requireBulletinRenderer({templateVersion: 'v1', rendererVersion: 'v6', rendererArtifactSha256: ui.BULLETIN_RENDERER_V6_DIGEST});
  `);
  run(vite, 'build');

  const next = resolve(temp, 'next');
  write(resolve(next, 'package.json'), JSON.stringify({
    private: true,
    packageManager: 'pnpm@10.12.1',
    scripts: {build: 'next build'},
    dependencies: {
      ...packageDependencies,
      next: '16.2.9',
      react: '19.2.7',
      'react-dom': '19.2.7'
    },
    devDependencies: {
      '@types/node': '24.10.13',
      '@types/react': '19.2.17',
      '@types/react-dom': '19.2.3',
      typescript: '6.0.3'
    },
    pnpm: {onlyBuiltDependencies: ['sharp'], overrides: packageDependencies}
  }, null, 2));
  write(resolve(next, 'app/layout.tsx'), `import '@hallelujahhomechurch/ui/styles.css';
import '@hallelujahhomechurch/ui/bulletin-paper.css';
export default function Layout({children}: {children: React.ReactNode}) {
  return <html><body>{children}</body></html>;
}
`);
  write(resolve(next, 'app/bulletin.ts'), bulletinModule);
  write(resolve(next, 'app/page.tsx'), `'use client';
import {createAccountSessionClient, createBrowserAccountAuthRuntime, createAccountDataRequestsClient, createInboxClient, type InboxAction, type InboxResource, type InboxSummary, type AccountSessionUser, type EmailReauthView, type EmailCorrectionSubmitInput, type EmailCorrectionRequest, type EmailCorrectionErrorCode} from '@hallelujahhomechurch/account-client';
import {canAccessAdmin} from '@hallelujahhomechurch/account-client/admin-access';
import {createHhcWebClient, type ContentStatus, type PageGroupManifest, type BroadcastStreamKey, type BroadcastStreamKeySetInput, type BroadcastStreamKeyBindInput, type BroadcastMutationResult} from '@hallelujahhomechurch/hhc-web-client';
import {createOperationsClient, type ManagedMemberView, type ManagedUnitFolder, type OrgJoinRequest, type OrgUnitDirectoryPage, type ReviewableOrgJoinRequestPage} from '@hallelujahhomechurch/operations-client';
import {getInitialTheme, readAnonymousStatementDismissal, writeAnonymousStatementDismissal, statementRefKey} from '@hallelujahhomechurch/preferences';
import {AccountMenu, Button, ContextMenu, BulletinDocumentRenderer, ExpandableSearchField, NotificationBell, NotificationList, type NotificationAppHref} from '@hallelujahhomechurch/ui';
import {createRef} from 'react';
import {HlsPlayer, type PlayerLabels} from '@hallelujahhomechurch/ui/player';
import '@hallelujahhomechurch/ui/player.css';
import {bulletin, bulletinV6} from './bulletin';
import {createSandboxDonationClient} from '@hallelujahhomechurch/donation-client';
import {DonationForm} from '@hallelujahhomechurch/donation-ui';

const playerLabels: PlayerLabels = {quality:'quality',auto:'auto',play:'play',pause:'pause',mute:'mute',unmute:'unmute',seek:'seek',volume:'volume',fullscreen:'fullscreen',exitFullscreen:'exitFullscreen',fullscreenError:'fullscreenError',playbackSpeed:'playbackSpeed',settings:'settings',togglePlayback:'togglePlayback',privateCopy:'privateCopy',buffering:'buffering'};
const player = <HlsPlayer playbackUrl="https://media.example.test/live/master.m3u8" availableQualities={['720p']} title="Preview" labels={playerLabels} videoRef={createRef<HTMLVideoElement>()} muted onError={() => {}} playbackMode="live" live={{verifiedEnd:120,canFollow:true,label:'Live',backToLive:'Back to live'}} />;
const accountUser: AccountSessionUser = {id: 'u1', email: 'ada@example.com', display_name: 'Ada', avatar_url: null};
const accountSessionClient = createAccountSessionClient();
const authRuntime = createBrowserAccountAuthRuntime({client: accountSessionClient});

const inboxClient = createInboxClient({auth: authRuntime});
async function checkInbox(action: InboxAction, resource: InboxResource) {
  const summary: InboxSummary = await inboxClient.summary({locale: 'en'});
  await inboxClient.list({filter: 'unread', limit: 20, locale: 'en'});
  await inboxClient.markRead('00000000-0000-4000-8000-000000000001');
  await inboxClient.markAllRead(summary.readSnapshotToken);
  if (action.type === 'bulletin') {const locale: 'zh-Hant' | 'zh-Hans' | 'en' | 'ja' | 'ko' = action.locale; void locale;}
  return resource;
}
void checkInbox;
const notificationLabels = {title:'Notifications', loading:'Loading', empty:'Empty', retry:'Retry', markRead:'Mark read', markAllRead:'Mark all read', unread:'Unread', read:'Read', viewAll:'View all', count:(n:number|null) => n === null ? 'Unknown' : String(n)};
const notificationHref: NotificationAppHref = '/en/notifications';
// @ts-expect-error Only known app destinations can be notification links.
const unsafeNotificationHref: NotificationAppHref = 'https://example.test';
void unsafeNotificationHref;
const notificationPresentation = <><NotificationBell labels={notificationLabels} unreadCount={123} isOpen={false} onOpenChange={() => {}} state={{status:'ready',items:[]}} viewAllLink={{href:notificationHref,label:'View all'}} /><NotificationList labels={notificationLabels} state={{status:'error',message:'Unavailable'}} onRetry={() => {}} /></>;

const dataRequests = createAccountDataRequestsClient(async () => {throw new Error('No network in consumer type check');});
async function checkEmailCorrection(intent: EmailReauthView, result: EmailCorrectionRequest, code: EmailCorrectionErrorCode) {
  if (intent.status === 'ready') {
    const input: EmailCorrectionSubmitInput = {kind: intent.kind, newEmail: intent.newEmail, proof: intent.proof, submissionNonce: intent.submissionNonce};
    await dataRequests.submit(input);
    await dataRequests.submission(input.submissionNonce);
  }
  await accountSessionClient.dataRequests.approve(result.id, {requestVersion: result.requestVersion});
  if (code === 'ACC_CORRECTION_NOT_FOUND') return;
}
void checkEmailCorrection;

const operationsClient = createOperationsClient({baseUrl: '', getAccessToken: authRuntime.getAccessToken, refreshAfterUnauthorized: authRuntime.refreshAfterUnauthorized});
const donationClient = createSandboxDonationClient({getAccessToken: authRuntime.getAccessToken, refreshAfterUnauthorized: authRuntime.refreshAfterUnauthorized});
const donationForm = <DonationForm transport={donationClient} onOrder={() => {}} />;
void donationForm;
async function checkUnitManagement(folder: ManagedUnitFolder, member: ManagedMemberView) {
  await operationsClient.raw.GET('/api/operations/manage/roots');
  await operationsClient.raw.GET('/api/operations/manage/org-units/{unitId}', {params: {path: {unitId: folder.unit.id}}});
  await operationsClient.raw.GET('/api/operations/manage/org-units/{unitId}/account-candidates', {params: {path: {unitId: folder.unit.id}, query: {q: '王小'}}});
  await operationsClient.raw.POST('/api/operations/manage/org-units/{unitId}/members', {params: {path: {unitId: folder.unit.id}, header: {'Idempotency-Key': 'admit'}}, body: {accountUserId: '00000000-0000-4000-8000-000000000001'}});
  await operationsClient.raw.POST('/api/operations/manage/org-units/{unitId}/entitlements/batch', {params: {path: {unitId: folder.unit.id}, header: {'Idempotency-Key': 'grant'}}, body: {memberIds: [member.memberId], entitlementCode: 'bulletin.general.zh-Hant.access', operation: 'grant'}});
}
void checkUnitManagement;
const groupClient = createOperationsClient({baseUrl: '', auth: authRuntime, getAccessToken: authRuntime.getAccessToken, refreshAfterUnauthorized: authRuntime.refreshAfterUnauthorized});
async function checkGroupApplications(id: string) {
  const directory: OrgUnitDirectoryPage = await groupClient.listOrgUnitDirectory({relation: 'all', q: 'group', limit: 20});
  const review: ReviewableOrgJoinRequestPage = await groupClient.listReviewableOrgJoinRequests({status: 'history', orgUnitId: id});
  const own = await groupClient.listOwnOrgJoinRequests({status: 'pending'});
  const created: OrgJoinRequest = await groupClient.createOrgJoinRequest({orgUnitId: id, idempotencyKey: 'create'});
  await groupClient.getOwnOrgJoinRequest(created.id);
  await groupClient.getReviewableOrgJoinRequest(created.id);
  await groupClient.cancelOrgJoinRequest(created.id, {version: created.version, idempotencyKey: 'cancel'});
  await groupClient.approveOrgJoinRequest(created.id, {version: created.version, idempotencyKey: 'approve'});
  await groupClient.rejectOrgJoinRequest(created.id, {version: created.version, idempotencyKey: 'reject'});
  // @ts-expect-error History is a list filter, never a resource status.
  const invalidStatus: OrgJoinRequest['status'] = 'history';
  void invalidStatus;
  return {directory, review, own};
}
void checkGroupApplications;
const statementRef = {statementId: '00000000-0000-4000-8000-000000000001', publishedVersion: 7};
void readAnonymousStatementDismissal(statementRef); void writeAnonymousStatementDismissal(statementRef); void statementRefKey(statementRef);
const statementClient = createHhcWebClient({baseUrl: '/api', getAccessToken: authRuntime.getAccessToken, refreshAfterUnauthorized: authRuntime.refreshAfterUnauthorized});
void statementClient.getStatementDismissal(statementRef); void statementClient.dismissStatement(statementRef);
const contentStatus: ContentStatus = 'pending_removal';
const groupManifest: PageGroupManifest = {pageId: '00000000-0000-0000-0000-000000000001', pageSourceVersion: 1, pageTargetVersion: 2, childModule: 'history', items: [], sha256: 'a'.repeat(64)};
void createAccountSessionClient;
void canAccessAdmin;
void operationsClient;
authRuntime.dispose();
async function checkBroadcastStreamKey(id: string, input: BroadcastStreamKeySetInput, binding: BroadcastStreamKeyBindInput) {
  const metadata: BroadcastStreamKey = await statementClient.getBroadcastStreamKey(id);
  const updated: BroadcastStreamKey = await statementClient.setBroadcastStreamKey(id, input);
  const result: BroadcastMutationResult = await statementClient.bindBroadcastStreamKey(id, binding);
  return {metadata, updated, result};
}
void checkBroadcastStreamKey;
void createHhcWebClient;
void contentStatus;
void groupManifest;
void getInitialTheme;
export default function Page() { return <>{notificationPresentation}{player}<BulletinDocumentRenderer document={bulletin} mode="paper" activePage={bulletin.pages[0].id} /><BulletinDocumentRenderer document={bulletinV6} mode="paper" activePage={bulletinV6.pages[0].id} /><Button>Smoke</Button><ExpandableSearchField label="Search" submitLabel="Submit" clearLabel="Clear" closeLabel="Close" allowEmptySubmit onExpandedChange={() => {}} /><ContextMenu label="Actions" x={0} y={0} isOpen={false} items={[]} onAction={() => {}} onOpenChange={() => {}} /><AccountMenu user={{name: accountUser.display_name, email: accountUser.email}} links={[{id: 'destination', label: 'Destination', href: 'https://example.com/destination'}]} labels={{menu: 'Account', greeting: 'Hi Ada', signOut: 'Sign out'}} onSignOut={() => {}} /></>; }
`);
  run(next, 'install', '--ignore-workspace');
  run(next, 'build');
} finally {
  rmSync(temp, {recursive: true, force: true});
}

console.log(`Packed consumer builds pass (${basename(artifacts)}).`);
