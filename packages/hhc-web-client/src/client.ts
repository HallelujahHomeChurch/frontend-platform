import createClient from 'openapi-fetch'

import type { components, operations, paths } from './generated.js'

export type LegalScope = components['schemas']['LegalScope']
export type LegalSnapshot = components['schemas']['LegalSnapshot']
export type LegalManifest = components['schemas']['LegalManifest']
export type LegalDraft = components['schemas']['LegalDraft']
export type LegalDocuments = components['schemas']['LegalDocuments']
export type ActiveStatement = components['schemas']['ActiveStatement']
export type StatementDismissal = components['schemas']['StatementDismissal']
export type StatementRef = Pick<StatementDismissal, 'statementId' | 'publishedVersion'>
export type StatementNotificationRequest = components['schemas']['StatementNotificationRequest']
export type ContentLocale = components['schemas']['ContentLocale']
export type BulletinSeries = components['schemas']['BulletinSeries']
export type BulletinLocale = components['schemas']['BulletinLocale']
export type BulletinEdition =
  | { series: 'general'; locale: BulletinLocale }
  | { series: 'children'; locale: Exclude<BulletinLocale, 'zh-Hans'> }
export type ContentTranslationTargetLocale = components['schemas']['ContentTranslationTargetLocale']
export type BulletinTranslationTargetEdition = components['schemas']['BulletinTranslationTargetEdition']
export type BulletinStatus = components['schemas']['BulletinStatus']
export type BulletinWatermarkLookup = components['schemas']['BulletinWatermarkLookupResult']
export type RecordingWatermarkLookup = components['schemas']['RecordingWatermarkLookupResult']
export type RecordingWatermarkLookupInput = components['schemas']['RecordingWatermarkLookupInput']
export type BulletinWatermarkVersion = components['schemas']['BulletinWatermarkVersion']
export type BulletinWatermarkInvestigationInput = Omit<components['schemas']['BulletinWatermarkInvestigationInput'], 'series'> & {series?: BulletinSeries}
export type BulletinWatermarkInvestigation = components['schemas']['BulletinWatermarkInvestigation']
export type BulletinTraceIdentity = components['schemas']['BulletinTraceIdentity']
export type BulletinWatermarkInvestigationRow = components['schemas']['BulletinWatermarkInvestigationGlobalRow']
export type BulletinWatermarkInvestigationPage = {
  items: BulletinWatermarkInvestigationRow[]
  nextCursor?: string
}
export type BulletinWatermarkIssueInvestigationRow = components['schemas']['BulletinWatermarkInvestigationRow']
export type BulletinWatermarkIssueInvestigationPage = {
  items: BulletinWatermarkIssueInvestigationRow[]
  nextCursor?: string
}
export type ProtectedBulletin = components['schemas']['ProtectedBulletin']
export type MemberOnlineDocument = components['schemas']['ReaderDocument']
export type OnlineBulletinAccess = components['schemas']['ReaderAccessEnvelope']['data']
export type OnlineBulletinDiscovery = components['schemas']['ReaderDiscoveryEnvelope']['data']
export type BulletinReaderState = components['schemas']['ReaderPrivateState']
export type BulletinReaderStateResponse = components['schemas']['ReaderStateEnvelope']['data']
export type BulletinReaderMutation = components['schemas']['ReaderMutation']
export type BulletinReaderMutationResponse = components['schemas']['ReaderMutationEnvelope']['data']
export type BulletinReaderNote = components['schemas']['ReaderNote']
export type BulletinReaderHighlightColor = components['schemas']['ReaderHighlightColor']
export type MemberRecording = components['schemas']['MemberRecording']
export type AdminRecording = components['schemas']['AdminRecording']
export type RecordingProcessingProgress = components['schemas']['RecordingProcessingProgress']
export type RecordingRetentionPolicy = components['schemas']['RecordingRetentionPolicy']
export type RecordingRetentionPreview = components['schemas']['RecordingRetentionPreview']
export type UpdateRecordingRetentionInput = components['schemas']['UpdateRecordingRetentionInput']
export type RecordingCover = components['schemas']['RecordingCover']
export type RecordingCoverList = components['schemas']['RecordingCoverList']
export type RecordingCoverSelection = components['schemas']['RecordingCoverSelection']
export type RecordingCoverSelectionResult = components['schemas']['RecordingCoverSelectionResult']
export type RecordingCoverUpload = components['schemas']['RecordingCoverUpload']
export type MemberRecordingPlayback = components['schemas']['MemberRecordingPlayback']
export type MemberLivePlayback = components['schemas']['MemberLivePlayback']
export type MemberLiveRecording = components['schemas']['MemberLiveRecording']
export type RecordingCaptureStatus = components['schemas']['RecordingCaptureStatus']
export type RecordingCaptureResult = components['schemas']['RecordingCaptureResult']
export type RecordingSourceInput = components['schemas']['RecordingSourceInput']
export type RecordingSource = components['schemas']['RecordingSource']
export type RecordingSourceStatus = components['schemas']['RecordingSourceStatus']
export type SignedRecordingSourceBlock = components['schemas']['SignedRecordingSourceBlock']
export type RecordingPackageStatus = components['schemas']['RecordingPackageStatus']
export type RecordingRendition = components['schemas']['RecordingRendition']
export type OperationProgress = components['schemas']['OperationProgress']
export type BulletinDownloadJob = components['schemas']['BulletinDownloadJob']
export type BulletinIssue = components['schemas']['BulletinIssue']
export type BulletinVersion = components['schemas']['BulletinVersion']
export type BulletinRevision = components['schemas']['BulletinRevision']
export type OnlineBulletinSelector = operations['getOnlineBulletinState']['parameters']['path']
export type OnlineBulletinState = components['schemas']['OnlineBulletinAdminState']
export type OnlineBulletinDraftInput = components['schemas']['OnlineBulletinDraftInput']
export type OnlineBulletinCompareInput = components['schemas']['OnlineBulletinCompareInput']
export type OnlineBulletinComparison = components['schemas']['OnlineBulletinComparison']
export type OnlineBulletinConfirmInput = components['schemas']['OnlineBulletinConfirmInput']
export type OnlineBulletinPublishInput = components['schemas']['OnlineBulletinPublishInput']
export type OnlineBulletinReviewIssue = components['schemas']['OnlineBulletinReviewIssue']
export type OnlineBulletinComponent = components['schemas']['OnlineBulletinComponent']
export type OnlineBulletinDocument = components['schemas']['OnlineBulletinDocument']
export type PageMeta = components['schemas']['PageMeta']
export type UploadTarget = components['schemas']['UploadTarget']
export type CreatedBulletinUpload = components['schemas']['CreatedUpload']
export type CreateBulletinUploadInput = Omit<components['schemas']['CreateBulletinUploadInput'], 'series' | 'locale'> & BulletinEdition
export type CompleteBulletinUploadInput = Omit<components['schemas']['CompleteBulletinUploadInput'], 'series' | 'locale'> & BulletinEdition
export type CustomNotificationSubmission = components['schemas']['CustomNotificationSubmission']
export type BulletinNotificationPreview = components['schemas']['BulletinNotificationPreview']
export type BulletinNotificationSubmission = components['schemas']['BulletinNotificationSubmission']
export type ContentModule = components['schemas']['ContentModule']
export type PublicationContentModule = components['schemas']['PublicationContentModule']
export type CreatableContentModule = components['schemas']['CreatableContentModule']
export type ContentStatus = components['schemas']['ContentStatus']
export type ContentItem = components['schemas']['ContentItem']
export type RichDocumentDraft = components['schemas']['RichDocumentDraft']
export type RichDocumentPublic = components['schemas']['RichDocumentPublic']
export type RichInlineNode = components['schemas']['RichInlineNode']
export type ContentTranslationPreview = components['schemas']['ContentTranslationPreview']
export type PageGroupManifest = components['schemas']['PageGroupManifest']
export type ContentWriteInput = components['schemas']['ContentWriteInput']
export type LocationWriteInput = {
  locationKey: string
  mapHref: string
  sortOrder: number
  translations: { locale: ContentLocale; title: string; body: string }[]
}
export type ContentRevision = components['schemas']['ContentRevision']
export type PublicContentItem = components['schemas']['PublicContentItem']
export type PageKey = components['parameters']['PageKey']
export type PageContent = components['schemas']['PageContent']
export type PublicEditorialPage = components['schemas']['PublicEditorialPage']
type FixedPageWriteInput<PageKey, PageTemplate, RoutePath, BodyJson> = {
  pageKey: PageKey
  pageTemplate: PageTemplate
  routePath: RoutePath
  indexable: boolean
  translations: { locale: ContentLocale; bodyJson: BodyJson }[]
  deleteLocales?: ContentLocale[]
}
export type PageWriteInput =
  | FixedPageWriteInput<'home', 'home.v1', '/', components['schemas']['HomePageContentV1']>
  | components['schemas']['HomePageWriteInputV2']
  | FixedPageWriteInput<'about', 'about.v1', '/about', components['schemas']['AboutPageContentV1']>
  | FixedPageWriteInput<'privacy-policy', 'legal.v1', '/privacy-policy', components['schemas']['LegalPageContentV1']>
  | FixedPageWriteInput<'terms-of-use', 'legal.v1', '/terms-of-use', components['schemas']['LegalPageContentV1']>
export type SiteLayout = components['schemas']['SiteLayout']
export type SiteSettingsWriteInput = components['schemas']['SiteSettingsWriteInput']
export type SiteSettings = components['schemas']['SiteSettings']
export type SiteSettingsRevision = components['schemas']['SiteSettingsRevision']
export type AssetStatus = components['schemas']['AssetStatus']
export type CreateImageUploadInput = components['schemas']['CreateImageUploadInput']
export type CompleteImageUploadInput = components['schemas']['CompleteImageUploadInput']
export type HomePageWriteInputV2 = components['schemas']['HomePageWriteInputV2']
export type HomeBannerUploadInput = components['schemas']['HomeBannerUploadInput']
export type HomeBannerCompleteInput = components['schemas']['HomeBannerCompleteInput']
export class HhcWebApiError extends Error {
  readonly status: number
  readonly code: string
  readonly contentId?: string
  readonly currentVersion?: number
  readonly canonicalVersion?: number
  readonly bulletinUnavailable: boolean

  constructor(status: number, code: string, message: string, contentId?: string, versions?: {currentVersion?: number; canonicalVersion?: number}, bulletinUnavailable = false) {
    super(message)
    this.name = 'HhcWebApiError'
    this.status = status
    this.code = code
    this.contentId = contentId
    this.currentVersion = versions?.currentVersion
    this.canonicalVersion = versions?.canonicalVersion
    this.bulletinUnavailable = bulletinUnavailable
  }
}

export function createHhcWebClient(options: {
  baseUrl: string
  getAccessToken: () => string | null | Promise<string | null>
  refreshAfterUnauthorized?: (rejectedToken: string) => Promise<string | null>
  fetcher?: typeof fetch
}) {
  const client = createClient<paths>({
    baseUrl: absoluteBaseUrl(options.baseUrl),
    fetch: options.fetcher,
  })

  client.use({
    async onRequest({ request }) {
      const token = await options.getAccessToken()
      if (token) request.headers.set('Authorization', `Bearer ${token}`)
      if (!request.headers.has('Accept')) request.headers.set('Accept', 'application/json')
      return request
    },
  })

  async function unwrap<T>(request: Promise<{ data?: T; error?: unknown; response: Response }>) {
    const result = await request
    if (result.error !== undefined || !result.response.ok) throw apiError(result.response, result.error)
    if (result.data === undefined) throw new HhcWebApiError(result.response.status, 'invalid_response', 'The API response did not include data.')
    return result.data
  }

  async function statementRequest<T>(request: () => Promise<T>): Promise<T> {
    const token = await options.getAccessToken()
    try {return await request()} catch (error) {
      if (!(error instanceof HhcWebApiError) || error.status !== 401 || !token || !options.refreshAfterUnauthorized) throw error
      if (!await options.refreshAfterUnauthorized(token)) throw error
      return request()
    }
  }

  async function listPublicContentPage(
    module: Exclude<ContentModule, 'locations' | 'pages'>,
    locale: ContentLocale,
    params: { page?: number; pageSize?: number; signal?: AbortSignal } = {},
  ) {
    const query = { locale, page: params.page, pageSize: params.pageSize }
    const result = module === 'news'
      ? client.GET('/news', { params: { query }, signal: params.signal })
      : module === 'history'
        ? client.GET('/history', { params: { query }, signal: params.signal })
        : module === 'videos'
          ? client.GET('/videos', { params: { query }, signal: params.signal })
          : Promise.reject(new Error('Use listLocations for locations.'))
    const envelope = await unwrap(result)
    return { data: envelope.data, meta: envelope.meta }
  }

  async function createAdminContent(module: CreatableContentModule, input: ContentWriteInput, idempotencyKey: string) {
    return (await unwrap(client.POST('/admin/content/{module}', {
      params: { path: { module }, header: { 'Idempotency-Key': idempotencyKey } }, body: input,
    }))).data
  }

  async function updateAdminContent(module: ContentModule, contentId: string, version: number, input: ContentWriteInput) {
    return (await unwrap(client.PUT('/admin/content/{module}/{contentId}', {
      params: { path: { module, contentId }, header: { 'If-Match': `"${version}"` } }, body: input,
    }))).data
  }

  return {
    async getReaderState({issueId, series, locale, fromRevision, signal}: {issueId: string; series: BulletinSeries; locale: BulletinLocale; fromRevision?: number; signal?: AbortSignal}): Promise<BulletinReaderStateResponse> {
      return (await unwrap(client.GET('/member/bulletins/{issueID}/versions/{locale}/online/reader/state', {params: {path: {issueID: issueId, locale}, query: {series, fromRevision}}, cache: 'no-store', signal}))).data
    },
    async applyReaderMutations({issueId, series, locale, mutations, signal}: {issueId: string; series: BulletinSeries; locale: BulletinLocale; mutations: BulletinReaderMutation[]; signal?: AbortSignal}): Promise<BulletinReaderMutationResponse> {
      return (await unwrap(client.POST('/member/bulletins/{issueID}/versions/{locale}/online/reader/mutations', {params: {path: {issueID: issueId, locale}, query: {series}}, body: {mutations}, cache: 'no-store', signal}))).data
    },
    async listOnlineBulletinDiscovery(params: {series: BulletinSeries; offset?: number; limit?: number; issueNumber?: number; signal?: AbortSignal} & ({locale: BulletinLocale; locales?: never} | {locales: readonly BulletinLocale[]; locale?: never})) {
      const {signal, locales, ...selectors} = params
      const query = {...selectors, locales: locales?.join(',')}
      return (await unwrap(client.GET('/member/bulletins/online', {params: {query}, cache: 'no-store', signal}))).data
    },
    async openOnlineBulletin(params: {issueId: string; series: BulletinSeries; locale: BulletinLocale; signal?: AbortSignal} & components['schemas']['ReaderAccessInput']): Promise<OnlineBulletinAccess> {
      const {issueId, series, locale, signal, ...body} = params
      const result = await client.POST('/member/bulletins/{issueID}/versions/{locale}/online/access', {params: {path: {issueID: issueId, locale}, query: {series}}, body, cache: 'no-store', parseAs: 'stream', signal})
      if (result.error !== undefined || !result.response.ok) throw apiError(result.response, result.error)
      const invalid = () => new HhcWebApiError(result.response.status, 'invalid_response', 'The reader response is invalid.')
      const hash = result.response.headers.get('X-HHC-Content-SHA256') ?? ''
      if (!result.data || !/^[a-f0-9]{64}$/.test(hash) || result.response.headers.get('Content-Type')?.split(';')[0]?.trim().toLowerCase() !== 'application/json') {
        await result.data?.cancel()
        throw invalid()
      }
      const bytes = await readBoundedBytes(result.response, result.data, 9 * 1024 * 1024)
      signal?.throwIfAborted()
      const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(value => value.toString(16).padStart(2, '0')).join('')
      signal?.throwIfAborted()
      if (digest !== hash) throw invalid()
      let envelope: components['schemas']['ReaderAccessEnvelope']
      try { envelope = JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(bytes)) }
      catch { throw invalid() }
      if (!envelope || envelope.error !== null || !envelope.data?.document || !envelope.data.access) throw invalid()
      return envelope.data
    },
    async getOnlineBulletinState(edition: OnlineBulletinSelector, signal?: AbortSignal) {
      return (await unwrap(client.GET('/admin/bulletins/{issueId}/online/{series}/{contentLocale}', {params: {path: edition}, cache: 'no-store', signal}))).data
    },
    async getOnlineBulletinComparison(edition: OnlineBulletinSelector, signal?: AbortSignal) {
      return (await unwrap(client.GET('/admin/bulletins/{issueId}/online/{series}/{contentLocale}/comparison', {params: {path: edition}, cache: 'no-store', signal}))).data
    },
    async listOnlineBulletinRevisions(edition: OnlineBulletinSelector, options: {before?: number; limit?: number; signal?: AbortSignal} = {}) {
      return (await unwrap(client.GET('/admin/bulletins/{issueId}/online/{series}/{contentLocale}/revisions', {params: {path: edition, query: {before: options.before, limit: options.limit}}, cache: 'no-store', signal: options.signal}))).data
    },
    async getOnlineBulletinRevision(edition: OnlineBulletinSelector, revision: number, signal?: AbortSignal) {
      return (await unwrap(client.GET('/admin/bulletins/{issueId}/online/{series}/{contentLocale}/revisions/{revision}', {params: {path: {...edition, revision}}, cache: 'no-store', signal}))).data
    },
    async startOnlineBulletinConversion(edition: operations['startOnlineBulletinConversion']['parameters']['path'], version: number, input: components['schemas']['OnlineBulletinConversionInput'], signal?: AbortSignal) {
      return (await unwrap(client.POST('/admin/bulletins/{issueId}/online/{series}/{contentLocale}/conversions', {params: {path: edition, header: {'If-Match': `"${version}"`}}, body: input, cache: 'no-store', signal}))).data
    },
    async startOnlineBulletinExtraction(edition: operations['startOnlineBulletinExtraction']['parameters']['path'], version: number, input: components['schemas']['OnlineBulletinExtractionInput'], signal?: AbortSignal) {
      return (await unwrap(client.POST('/admin/bulletins/{issueId}/online/{series}/{contentLocale}/extractions', {params: {path: edition, header: {'If-Match': `"${version}"`}}, body: input, cache: 'no-store', signal}))).data
    },
    async saveOnlineBulletinDraft(edition: OnlineBulletinSelector, version: number, input: OnlineBulletinDraftInput, signal?: AbortSignal) {
      return (await unwrap(client.PUT('/admin/bulletins/{issueId}/online/{series}/{contentLocale}/draft', {params: {path: edition, header: {'If-Match': `"${version}"`}}, body: input, cache: 'no-store', signal}))).data
    },
    async applyOnlineBulletinComparison(edition: OnlineBulletinSelector, version: number, input: OnlineBulletinCompareInput, signal?: AbortSignal) {
      return (await unwrap(client.POST('/admin/bulletins/{issueId}/online/{series}/{contentLocale}/compare', {params: {path: edition, header: {'If-Match': `"${version}"`}}, body: input, cache: 'no-store', signal}))).data
    },
    async confirmOnlineBulletin(edition: OnlineBulletinSelector, version: number, input: OnlineBulletinConfirmInput, signal?: AbortSignal) {
      return (await unwrap(client.POST('/admin/bulletins/{issueId}/online/{series}/{contentLocale}/confirm', {params: {path: edition, header: {'If-Match': `"${version}"`}}, body: input, cache: 'no-store', signal}))).data
    },
    async publishOnlineBulletin(edition: OnlineBulletinSelector, version: number, input: OnlineBulletinPublishInput, signal?: AbortSignal) {
      return (await unwrap(client.POST('/admin/bulletins/{issueId}/online/{series}/{contentLocale}/publish', {params: {path: edition, header: {'If-Match': `"${version}"`}}, body: input, cache: 'no-store', signal}))).data
    },
    async unpublishOnlineBulletin(edition: OnlineBulletinSelector, version: number, input: components['schemas']['OnlineBulletinRestoreInput'], signal?: AbortSignal) {
      return (await unwrap(client.POST('/admin/bulletins/{issueId}/online/{series}/{contentLocale}/unpublish', {params: {path: edition, header: {'If-Match': `"${version}"`}}, body: input, cache: 'no-store', signal}))).data
    },
    async restoreOnlineBulletinRevision(edition: OnlineBulletinSelector, revision: number, version: number, input: components['schemas']['OnlineBulletinRestoreInput'], signal?: AbortSignal) {
      return (await unwrap(client.POST('/admin/bulletins/{issueId}/online/{series}/{contentLocale}/revisions/{revision}/restore', {params: {path: {...edition, revision}, header: {'If-Match': `"${version}"`}}, body: input, cache: 'no-store', signal}))).data
    },
    async getOnlineBulletinSourcePDF(edition: operations['getOnlineBulletinSourcePDF']['parameters']['path'], signal?: AbortSignal) {
      const result = await client.GET('/admin/bulletins/{issueId}/online/{series}/{contentLocale}/source-pdf', {params: {path: edition}, headers: {Accept: 'application/pdf'}, parseAs: 'stream', cache: 'no-store', signal})
      if (result.error !== undefined || !result.response.ok) throw apiError(result.response, result.error)
      const invalid = () => new HhcWebApiError(result.response.status, 'invalid_response', 'The source PDF response is invalid.')
      const checksum = result.response.headers.get('X-HHC-Source-SHA256') ?? ''
      const canonicalVersion = Number(result.response.headers.get('X-HHC-Source-Version'))
      if (!result.data || result.response.headers.get('Content-Type')?.split(';')[0]?.trim().toLowerCase() !== 'application/pdf' || !/^[a-f0-9]{64}$/.test(checksum) || !Number.isSafeInteger(canonicalVersion) || canonicalVersion < 1) {
        await result.data?.cancel()
        throw invalid()
      }
      const bytes = await readBoundedBytes(result.response, result.data, 20 * 1024 * 1024)
      if (bytes.length < 5 || new TextDecoder().decode(bytes.subarray(0, 5)) !== '%PDF-') throw invalid()
      return {bytes: bytes.buffer, checksum, canonicalVersion}
    },
    async getRecordingRetentionPolicy(signal?:AbortSignal) {
      return (await unwrap(client.GET('/admin/recordings/retention-policy',{signal,cache:'no-store'}))).data
    },
    async previewRecordingRetentionPolicy(retentionDays:number,signal?:AbortSignal) {
      if(!Number.isInteger(retentionDays)||retentionDays<1||retentionDays>365)throw new HhcWebApiError(400,'invalid_retention','Enter 1–365 days.')
      return (await unwrap(client.POST('/admin/recordings/retention-policy/preview',{body:{retentionDays},signal,cache:'no-store'}))).data
    },
    async updateRecordingRetentionPolicy(body:UpdateRecordingRetentionInput,key:string,signal?:AbortSignal) {
      if(!Number.isInteger(body.retentionDays)||body.retentionDays<1||body.retentionDays>365||!Number.isSafeInteger(body.expectedRevision)||body.expectedRevision<1||!body.previewId||!key)throw new HhcWebApiError(400,'invalid_retention','Confirm a current retention preview.')
      return (await unwrap(client.PUT('/admin/recordings/retention-policy',{body,params:{header:{'Idempotency-Key':key}},signal,cache:'no-store'}))).data
    },
    async getCommonLegalSnapshot(locale: ContentLocale, signal?: AbortSignal) {
      return (await unwrap(client.GET('/legal/common', {params: {query: {locale}}, signal, cache: 'no-store'}))).data
    },
    async getMemberLegalSnapshot(locale: ContentLocale, signal?: AbortSignal) {
      return (await unwrap(client.GET('/member/legal/current', {params: {query: {locale}}, signal, cache: 'no-store'}))).data
    },
    async getLegalDraft(scope: LegalScope, signal?: AbortSignal) {
      return (await unwrap(client.GET('/admin/legal/{scope}', {params: {path: {scope}}, signal, cache: 'no-store'}))).data
    },
    async saveLegalDraft(scope: LegalScope, version: number, body: LegalDraft) {
      if (body.scope !== scope || !Number.isSafeInteger(version) || version < 0) throw new Error('Invalid legal draft version or scope')
      return (await unwrap(client.PUT('/admin/legal/{scope}', {params: {path: {scope}, header: {'If-Match': `"${version}"`}}, body, cache: 'no-store'}))).data
    },
    async publishLegalDraft(scope: LegalScope, version: number) {
      if (!Number.isSafeInteger(version) || version < 1) throw new Error('Invalid legal publication version')
      return (await unwrap(client.POST('/admin/legal/{scope}/publish', {params: {path: {scope}, header: {'If-Match': `"${version}"`}}, cache: 'no-store'}))).data
    },
    async listMemberLivestreams(signal?: AbortSignal) {
      return (await unwrap(client.GET('/member/recordings/live', {signal, cache: 'no-store'}))).data
    },
    async issueLiveRecordingPlayback(id: string, captureId: string, playbackScopeId: string, signal?: AbortSignal) {
      return (await unwrap(client.POST('/member/recordings/{id}/live/playback', {
        params: {path: {id}}, body: {captureId, playbackScopeId}, signal, cache: 'no-store',
      }))).data
    },
    async getRecordingCapture(id: string, captureId: string, options: {cursor?: string; limit?: number; signal?: AbortSignal} = {}) {
      return (await unwrap(client.GET('/admin/recordings/{id}/captures/{captureId}', {
        params: {path: {id, captureId}, query: {cursor: options.cursor, limit: options.limit}}, signal: options.signal, cache: 'no-store',
      }))).data
    },
    async closeRecordingLive(id: string, captureId: string, operationKey: string, signal?: AbortSignal) {
      return (await unwrap(client.DELETE('/admin/recordings/{id}/captures/{captureId}/live', {
        params: {path: {id, captureId}}, body: {operationKey}, signal, cache: 'no-store',
      }))).data
    },
    async cancelRecordingAutoPublish(id: string, captureId: string, operationKey: string, signal?: AbortSignal) {
      return (await unwrap(client.DELETE('/admin/recordings/{id}/captures/{captureId}/auto-publish', {
        params: {path: {id, captureId}}, body: {operationKey}, signal, cache: 'no-store',
      }))).data
    },
    async listMemberRecordingsPage(options: {limit?: number; cursor?: string; signal?: AbortSignal} = {}) {
      const result = await unwrap(client.GET('/member/recordings', {
        params: {query: {limit: options.limit ?? 12, cursor: options.cursor}}, signal: options.signal, cache: 'no-store',
      }))
      const cursor = result.meta.nextCursor
      if (cursor !== null && typeof cursor !== 'string') throw new HhcWebApiError(502, 'invalid_response', 'Recording pagination is unavailable.')
      return {items: result.data, nextCursor: cursor}
    },
    async listMemberRecordings(signal?: AbortSignal) {
      return (await unwrap(client.GET('/member/recordings', { signal, cache: 'no-store' }))).data
    },
    async listRecordingCovers(id:string,signal?:AbortSignal) {
      return (await unwrap(client.GET('/admin/recordings/{id}/covers',{params:{path:{id}},signal,cache:'no-store'}))).data
    },
    async uploadRecordingCover(id:string,blob:Blob,key:string,signal?:AbortSignal) {
      if(!['image/jpeg','image/png'].includes(blob.type)||blob.size<1||blob.size>5*1024*1024) throw new HhcWebApiError(422,'invalid_cover','Choose JPEG or PNG up to 5 MiB.')
      return (await unwrap(client.POST('/admin/recordings/{id}/cover-uploads',{
        params:{path:{id},header:{'Idempotency-Key':key}},headers:{'Content-Type':blob.type},body:'',bodySerializer:()=>blob,signal,cache:'no-store',redirect:'error',
      }))).data
    },
    async setRecordingCover(id:string,version:number,selection:RecordingCoverSelection,key:string,signal?:AbortSignal) {
      return (await unwrap(client.PUT('/admin/recordings/{id}/cover',{
        params:{path:{id},header:{'If-Match':`"${version}"`,'Idempotency-Key':key}},body:selection,signal,cache:'no-store',
      }))).data
    },
    async getRecordingCoverContent(id:string,coverId:string,signal?:AbortSignal) {
      return unwrap(client.GET('/admin/recordings/{id}/covers/{coverId}/content',{
        params:{path:{id,coverId}},signal,cache:'no-store',redirect:'error',parseAs:'blob',headers:{Accept:'image/jpeg'},
      }))
    },
    async getMemberRecordingCover(id:string,signal?:AbortSignal) {
      return unwrap(client.GET('/member/recordings/{id}/cover',{
        params:{path:{id}},signal,cache:'no-store',redirect:'error',parseAs:'blob',headers:{Accept:'image/jpeg'},
      }))
    },
    async issueRecordingPlayback(id: string, playbackScopeId: string, expectedAssetVersionId?: string, signal?: AbortSignal) {
      return (await unwrap(client.POST('/member/recordings/{id}/playback', {
        params: { path: { id } }, body: { playbackScopeId, expectedAssetVersionId }, signal, cache: 'no-store',
      }))).data
    },
    async listAdminRecordings(signal?: AbortSignal) {
      return (await unwrap(client.GET('/admin/recordings', { signal, cache: 'no-store' }))).data
    },
    async getAdminRecording(id: string, signal?: AbortSignal) {
      return (await unwrap(client.GET('/admin/recordings/{id}', { params: { path: { id } }, signal, cache: 'no-store' }))).data
    },
    async createAdminRecording(title: string, idempotencyKey: string) {
      return (await unwrap(client.POST('/admin/recordings', {
        params: { header: { 'Idempotency-Key': idempotencyKey } }, body: { title },
      }))).data
    },
    async updateAdminRecordingTitle(id: string, version: number, title: string, description?:string) {
      return (await unwrap(client.PATCH('/admin/recordings/{id}', {
        params: { path: { id }, header: { 'If-Match': `"${version}"` } }, body: { title, ...(description!==undefined?{description}:{}) },
      }))).data
    },
    async setAdminRecordingExposure(id: string, version: number, featured: boolean, hidden: boolean) {
      await unwrap(client.PATCH('/admin/recordings/{id}/exposure', {
        params: { path: { id }, header: { 'If-Match': `"${version}"` } }, body: { featured, hidden },
      }))
      throw new HhcWebApiError(410,'retired','Recording exposure controls are retired.')
    },
    async publishAdminRecording(id: string, version: number) {
      const data = (await unwrap(client.POST('/admin/recordings/{id}/publish', {
        params: { path: { id }, header: { 'If-Match': `"${version}"` } }, body: {},
      }))).data
      // No Idempotency-Key is sent by this human-admin compatibility method.
      if ('receipt' in data) throw new HhcWebApiError(200, 'invalid_response', 'Unexpected keyed publication response.')
      return data
    },
    async unpublishAdminRecording(id: string, version: number) {
      return (await unwrap(client.POST('/admin/recordings/{id}/unpublish', {
        params: { path: { id }, header: { 'If-Match': `"${version}"` } },
      }))).data
    },
    async createAdminRecordingSource(id: string, input: RecordingSourceInput, idempotencyKey: string, signal?: AbortSignal) {
      return (await unwrap(client.POST('/admin/recordings/{id}/source-uploads', {
        params: {path: {id}, header: {'Idempotency-Key': idempotencyKey}}, body: input, signal, cache: 'no-store',
      }))).data
    },
    async getAdminRecordingSource(id: string, sourceID: string, options: {cursor?: number; limit?: number; signal?: AbortSignal} = {}) {
      return (await unwrap(client.GET('/admin/recordings/{id}/source-uploads/{sourceID}', {
        params: {path: {id, sourceID}, query: {cursor: options.cursor, limit: options.limit}}, signal: options.signal, cache: 'no-store',
      }))).data
    },
    async signAdminRecordingSource(id: string, sourceID: string, numbers: number[], signal?: AbortSignal) {
      return (await unwrap(client.POST('/admin/recordings/{id}/source-uploads/{sourceID}/sign', {
        params: {path: {id, sourceID}}, body: {numbers}, signal, cache: 'no-store',
      }))).data
    },
    async completeAdminRecordingSource(id: string, sourceID: string, signal?: AbortSignal) {
      return (await unwrap(client.POST('/admin/recordings/{id}/source-uploads/{sourceID}/complete', {
        params: {path: {id, sourceID}}, body: {}, signal, cache: 'no-store',
      }))).data
    },
    async retryAdminRecordingSource(id: string, sourceID: string, signal?: AbortSignal) {
      return (await unwrap(client.POST('/admin/recordings/{id}/source-uploads/{sourceID}/retry-processing', {
        params: {path: {id, sourceID}}, body: {}, signal, cache: 'no-store',
      }))).data
    },
    async getAdminRecordingPackage(id: string, packageID: string, signal?: AbortSignal) {
      return (await unwrap(client.GET('/admin/recordings/{id}/packages/{packageID}', {
        params: {path: {id, packageID}, query: {limit: 1}}, signal, cache: 'no-store',
      }))).data
    },
    async listProtectedBulletins(params: { locale: BulletinLocale; series?: BulletinSeries; issueNumber?: number; page?: number; pageSize?: number; signal?: AbortSignal }) {
      const envelope = await unwrap(client.GET('/member/bulletins', {
        params: { query: { locale: params.locale, series: params.series, issueNumber: params.issueNumber, page: params.page, pageSize: params.pageSize } }, signal: params.signal, cache: 'no-store',
      }))
      return { data: envelope.data, meta: envelope.meta }
    },
    async getLatestProtectedBulletin(locale: BulletinLocale, series: BulletinSeries = 'general', signal?: AbortSignal) {
      return (await unwrap(client.GET('/member/bulletins/latest', { params: { query: { locale, series } }, signal, cache: 'no-store' }))).data
    },
    async getProtectedBulletinVersion(issueID: string, locale: BulletinLocale, series: BulletinSeries = 'general', signal?: AbortSignal) {
      return (await unwrap(client.GET('/member/bulletins/{issueID}/versions/{locale}', {
        params: {path: {issueID, locale}, query: {series}}, signal, cache: 'no-store',
      }))).data
    },
    async createBulletinDownloadJob(issueId: string, locale: BulletinLocale, series: BulletinSeries, idempotencyKey: string, signal?: AbortSignal) {
      return (await unwrap(client.POST('/member/bulletin-download-jobs', {
        params: { query: { series, locale }, header: { 'Idempotency-Key': idempotencyKey } }, body: { issueId }, signal, cache: 'no-store',
      }))).data
    },
    async getBulletinDownloadJob(id: string, locale: BulletinLocale, series: BulletinSeries, signal?: AbortSignal) {
      return (await unwrap(client.GET('/member/bulletin-download-jobs/{id}', {
        params: { path: { id }, query: { series, locale } }, signal, cache: 'no-store',
      }))).data
    },
    async listBulletinWatermarkVersions(issueId: string, signal?: AbortSignal) {
      return (await unwrap(client.GET('/admin/bulletins/{issueId}/watermark-versions', {
        params: {path: {issueId}}, signal, cache: 'no-store',
      }))).data.versions
    },
    async listAllBulletinWatermarkInvestigations(params: {cursor?: string; limit?: number; sort?: 'submitted' | 'requested' | 'actual' | 'status' | 'operator' | 'account' | 'issued'; direction?: 'asc' | 'desc'; signal?: AbortSignal} = {}): Promise<BulletinWatermarkInvestigationPage> {
      const envelope = await unwrap(client.GET('/admin/bulletin-watermark-investigations', {
        params: {query: {cursor: params.cursor, limit: params.limit, sort: params.sort, direction: params.direction}}, signal: params.signal, cache: 'no-store',
      }))
      return {items: envelope.data.items, nextCursor: envelope.meta?.nextCursor}
    },
    async listBulletinWatermarkInvestigations(issueId: string, params: {cursor?: string; limit?: number; signal?: AbortSignal} = {}): Promise<BulletinWatermarkIssueInvestigationPage> {
      const envelope = await unwrap(client.GET('/admin/bulletins/{issueId}/watermark-investigations', {
        params: {path: {issueId}, query: {cursor: params.cursor, limit: params.limit}}, signal: params.signal, cache: 'no-store',
      }))
      return {items: envelope.data.items, nextCursor: envelope.meta?.nextCursor}
    },
    async createBulletinWatermarkInvestigation(input: BulletinWatermarkInvestigationInput, files: Blob[], idempotencyKey: string, signal?: AbortSignal) {
      const metadata = JSON.stringify(input)
      const form = new FormData()
      form.set('metadata', metadata)
      for (const [index, file] of files.entries()) {
        const extension = file.type === 'application/pdf' ? 'pdf' : file.type === 'image/jpeg' ? 'jpg' : 'png'
        form.append('files', file, `evidence-${index + 1}.${extension}`)
      }
      return (await unwrap(client.POST('/admin/bulletin-watermark-investigations', {
        params: {header: {'Idempotency-Key': idempotencyKey}}, signal, cache: 'no-store',
        // OpenAPI binary fields are strings; the serializer supplies the actual Blob.
        body: {metadata, files: []}, bodySerializer: () => form,
      }))).data
    },
    async getBulletinWatermarkInvestigation(id: string, signal?: AbortSignal) {
      return (await unwrap(client.GET('/admin/bulletin-watermark-investigations/{id}', {
        params: {path: {id}}, signal, cache: 'no-store',
      }))).data
    },
    async lookupBulletinWatermark(code: string, signal?: AbortSignal) {
      return (await unwrap(client.POST('/admin/bulletins/watermark-lookups', {body: {code}, signal, cache: 'no-store'}))).data
    },
    async lookupRecordingWatermark(input: RecordingWatermarkLookupInput, signal?: AbortSignal): Promise<RecordingWatermarkLookup> {
      return (await unwrap(client.POST('/admin/recordings/watermark-lookups', {body:input, signal, cache:'no-store'}))).data
    },
    async listAdminBulletins(params: { page?: number; pageSize?: number; status?: BulletinStatus; query?: string; sort?: 'issueNumber' | 'date' | 'title' | 'languages' | 'status' | 'updated'; direction?: 'asc' | 'desc'; signal?: AbortSignal } = {}) {
      const envelope = await unwrap(client.GET('/admin/bulletins', {
        params: { query: { page: params.page, pageSize: params.pageSize, status: params.status, q: params.query, sort: params.sort, direction: params.direction } },
        signal: params.signal,
      }))
      return { data: envelope.data, meta: envelope.meta }
    },
    async getAdminBulletin(issueId: string, signal?: AbortSignal) {
      return (await unwrap(client.GET('/admin/bulletins/{issueId}', { params: { path: { issueId } }, signal }))).data
    },
    async updateBulletin(issueId: string, version: number, issueNumber: number, issueDate: string) {
      return (await unwrap(client.PUT('/admin/bulletins/{issueId}', {
        params: { path: { issueId }, header: { 'If-Match': `"${version}"` } },
        body: { issueNumber, issueDate },
      }))).data
    },
    async getBulletinAssetStatus(issueId: string, assetId: string, signal?: AbortSignal) {
      return (await unwrap(client.GET('/admin/bulletins/{issueId}/assets/{assetId}', { params: { path: { issueId, assetId } }, signal }))).data
    },
    async retryBulletinAssetScan(issueId: string, assetId: string) {
      return (await unwrap(client.POST('/admin/bulletins/{issueId}/assets/{assetId}/scan/retry', { params: { path: { issueId, assetId } } }))).data
    },
    async createBulletin(issueNumber: number, issueDate: string, idempotencyKey: string) {
      return (await unwrap(client.POST('/admin/bulletins', {
        params: { header: { 'Idempotency-Key': idempotencyKey } },
        body: { issueNumber, issueDate },
      }))).data
    },
    async createBulletinUpload(issueId: string, input: CreateBulletinUploadInput, idempotencyKey: string, signal?: AbortSignal) {
      return (await unwrap(client.POST('/admin/bulletins/{issueId}/upload-sessions', {
        params: { path: { issueId }, header: { 'Idempotency-Key': idempotencyKey } },
        body: input,
        signal,
      }))).data
    },
    async updateBulletinVersion(issueId: string, edition: BulletinEdition, version: number, title: string, subtitle: string) {
      return (await unwrap(client.PUT('/admin/bulletins/{issueId}/versions/{locale}', {
        params: { path: { issueId, locale: edition.locale }, query: { series: edition.series }, header: { 'If-Match': `"${version}"` } },
        body: { title, subtitle },
      }))).data
    },
    async deleteBulletinVersion(issueId: string, edition: BulletinEdition, version: number) {
      return (await unwrap(client.DELETE('/admin/bulletins/{issueId}/versions/{locale}', {
        params: { path: { issueId, locale: edition.locale }, query: { series: edition.series }, header: { 'If-Match': `"${version}"` } },
      }))).data
    },
    async completeBulletinUpload(issueId: string, assetId: string, version: number, input: CompleteBulletinUploadInput, signal?: AbortSignal) {
      return (await unwrap(client.POST('/admin/bulletins/{issueId}/assets/{assetId}/complete', {
        params: { path: { issueId, assetId }, header: { 'If-Match': `"${version}"` } },
        body: input,
        signal,
      }))).data
    },
    async publishBulletin(issueId: string, version: number, edition: BulletinEdition, options: { notifySubscribers: boolean }) {
      return (await unwrap(client.POST('/admin/bulletins/{issueId}/publish', {
        params: { path: { issueId }, header: { 'If-Match': `"${version}"` } },
        body: { ...edition, notifySubscribers: options.notifySubscribers },
      }))).data
    },
    async unpublishBulletin(issueId: string, version: number, edition: BulletinEdition, options?: { unpublishOnline: true; onlineVersion: number }) {
      let body: components['schemas']['BulletinUnpublishInput'] = { ...edition, notifySubscribers: false, unpublishOnline: false }
      if (options?.unpublishOnline) {
        if (edition.series !== 'general' || edition.locale !== 'zh-Hant' || !Number.isSafeInteger(options.onlineVersion) || options.onlineVersion < 1) {
          throw new HhcWebApiError(400, 'invalid_request', 'Paired unpublish requires a supported edition and Online version.')
        }
        body = { series: 'general', locale: 'zh-Hant', notifySubscribers: false, unpublishOnline: true, onlineVersion: options.onlineVersion }
      }
      return (await unwrap(client.POST('/admin/bulletins/{issueId}/unpublish', {
        params: { path: { issueId }, header: { 'If-Match': `"${version}"` } },
        body,
      }))).data
    },
    async previewBulletinNotification(issueId: string, series: BulletinSeries, signal?: AbortSignal) {
      return (await unwrap(client.GET('/admin/bulletins/{issueId}/notification-preview', {
        params: { path: { issueId }, query: { series } }, signal,
      }))).data
    },
    async submitBulletinNotification(issueId: string, series: BulletinSeries, idempotencyKey: string, signal?: AbortSignal) {
      return (await unwrap(client.POST('/admin/bulletins/{issueId}/notifications', {
        params: { path: { issueId }, query: { series }, header: { 'Idempotency-Key': idempotencyKey } }, body: {}, signal,
      }))).data
    },
    async submitCustomNotifications(input: CustomNotificationSubmission, idempotencyKey: string, signal?: AbortSignal) {
      const result = await client.POST('/admin/campaign-submissions', {
        params: { header: { 'Idempotency-Key': idempotencyKey } }, body: input, signal,
      })
      if (result.error !== undefined || !result.response.ok) throw apiError(result.response, result.error)
    },
    async deleteBulletin(issueId: string, version: number) {
      const result = await client.DELETE('/admin/bulletins/{issueId}', {
        params: { path: { issueId }, header: { 'If-Match': `"${version}"` } },
      })
      if (result.error !== undefined || !result.response.ok) throw apiError(result.response, result.error)
    },
    async listBulletinRevisions(issueId: string) {
      return (await unwrap(client.GET('/admin/bulletins/{issueId}/revisions', { params: { path: { issueId } } }))).data
    },
    async restoreBulletinRevision(issueId: string, revision: number, version: number) {
      return (await unwrap(client.POST('/admin/bulletins/{issueId}/revisions/{revision}/restore', {
        params: { path: { issueId, revision }, header: { 'If-Match': `"${version}"` } },
      }))).data
    },
    async uploadFile(target: UploadTarget, file: File, signal?: AbortSignal) {
      const headers = new Headers(target.headers)
      if (!headers.has('Content-Type')) headers.set('Content-Type', file.type || 'application/octet-stream')
      const response = await (options.fetcher ?? globalThis.fetch)(target.url, {
        method: target.method,
        headers,
        body: file,
        signal,
      })
      if (!response.ok) throw new HhcWebApiError(response.status, 'upload_failed', 'The file could not be uploaded.')
    },
    async getStatementDismissal(ref: StatementRef, signal?: AbortSignal): Promise<StatementDismissal> {
      return statementRequest(async () => (await unwrap(client.GET('/me/statements/{statementId}/dismissal', {params: {path: {statementId: ref.statementId}, query: {publishedVersion: ref.publishedVersion}}, cache: 'no-store', signal}))).data)
    },
    async dismissStatement(ref: StatementRef, signal?: AbortSignal): Promise<StatementDismissal> {
      return statementRequest(async () => (await unwrap(client.PUT('/me/statements/{statementId}/dismissal', {params: {path: {statementId: ref.statementId}}, body: {publishedVersion: ref.publishedVersion}, cache: 'no-store', signal}))).data)
    },
    async getActiveStatement(locale: ContentLocale, signal?: AbortSignal) {
      return (await unwrap(client.GET('/statements/active', { params: { query: { locale } }, cache: 'no-store', signal }))).data
    },
    async endStatementPopup(contentId: string, version: number) {
      return (await unwrap(client.POST('/admin/content/news/{contentId}/statement-popup/end', { params: { path: { contentId }, header: { 'If-Match': `"${version}"` } } }))).data
    },
    async listContent(module: ContentModule, params: {
      kind?: 'general' | 'statement'
      page?: number
      pageSize?: number
      query?: string
      status?: ContentStatus
      sort?: 'updatedAt' | 'displayDate' | 'eventDate' | 'title' | 'languages' | 'status' | 'youtubeVideoId' | 'homeEligible'
      direction?: 'asc' | 'desc'
      signal?: AbortSignal
    } = {}) {
      const envelope = await unwrap(client.GET('/admin/content/{module}', {
        params: {
          path: { module },
          query: {
            kind: params.kind,
            page: params.page,
            pageSize: params.pageSize,
            q: params.query,
            status: params.status,
            sort: params.sort,
            direction: params.direction,
          },
        },
        signal: params.signal,
      }))
      return { data: envelope.data, meta: envelope.meta }
    },
    async getContent(module: ContentModule, contentId: string, signal?: AbortSignal) {
      return (await unwrap(client.GET('/admin/content/{module}/{contentId}', { params: { path: { module, contentId } }, signal }))).data
    },
    async createContent(module: CreatableContentModule, input: ContentWriteInput, idempotencyKey: string) {
      return createAdminContent(module, input, idempotencyKey)
    },
    async updateContent(module: ContentModule, contentId: string, version: number, input: ContentWriteInput) {
      return updateAdminContent(module, contentId, version, input)
    },
    async createLocation(input: LocationWriteInput, idempotencyKey: string) {
      return createAdminContent('locations', input as ContentWriteInput, idempotencyKey)
    },
    async updateLocation(contentId: string, version: number, input: LocationWriteInput) {
      return updateAdminContent('locations', contentId, version, input as ContentWriteInput)
    },
    async updatePage(contentId: string, version: number, input: PageWriteInput) {
      return updateAdminContent('pages', contentId, version, input as ContentWriteInput)
    },
    async publishContent(module: PublicationContentModule, contentId: string, version: number, statementNotification?: StatementNotificationRequest) {
      return (await unwrap(client.POST('/admin/content/{module}/{contentId}/publish', {
        body: statementNotification ? { statementNotification } : undefined,
        params: { path: { module, contentId }, header: { 'If-Match': `"${version}"` } },
      }))).data
    },
    async unpublishContent(module: PublicationContentModule, contentId: string, version: number) {
      return (await unwrap(client.POST('/admin/content/{module}/{contentId}/unpublish', {
        params: { path: { module, contentId }, header: { 'If-Match': `"${version}"` } },
      }))).data
    },
    async deleteContent(module: Exclude<ContentModule, 'pages'>, contentId: string, version: number) {
      const result = await client.DELETE('/admin/content/{module}/{contentId}', {
        params: { path: { module, contentId }, header: { 'If-Match': `"${version}"` } },
      })
      if (result.error !== undefined || !result.response.ok) throw apiError(result.response, result.error)
    },
    async listContentRevisions(module: ContentModule, contentId: string) {
      return (await unwrap(client.GET('/admin/content/{module}/{contentId}/revisions', { params: { path: { module, contentId } } }))).data
    },
    async restoreContentRevision(module: PublicationContentModule, contentId: string, revision: number, version: number) {
      return (await unwrap(client.POST('/admin/content/{module}/{contentId}/revisions/{revision}/restore', {
        params: { path: { module, contentId, revision }, header: { 'If-Match': `"${version}"` } },
      }))).data
    },
    async createNewsCoverUpload(contentId: string, input: CreateImageUploadInput, idempotencyKey: string, signal?: AbortSignal) {
      return (await unwrap(client.POST('/admin/content/news/{contentId}/upload-sessions', {
        params: { path: { contentId }, header: { 'Idempotency-Key': idempotencyKey } }, body: input,
        signal,
      }))).data
    },
    async completeNewsCoverUpload(contentId: string, assetId: string, version: number, input: CompleteImageUploadInput, signal?: AbortSignal) {
      return (await unwrap(client.POST('/admin/content/news/{contentId}/assets/{assetId}/complete', {
        params: { path: { contentId, assetId }, header: { 'If-Match': `"${version}"` } }, body: input,
        signal,
      }))).data
    },
    async getNewsCoverStatus(contentId: string, assetId: string, signal?: AbortSignal) {
      return (await unwrap(client.GET('/admin/content/news/{contentId}/assets/{assetId}', { params: { path: { contentId, assetId } }, signal }))).data
    },
    async previewStatementInlineImage(contentId: string, assetId: string, signal?: AbortSignal) {
      return unwrap(client.GET('/admin/content/news/{contentId}/assets/{assetId}/preview', {
        params: { path: { contentId, assetId } }, signal, parseAs: 'blob', cache: 'no-store',
      }))
    },
    async retryNewsCoverScan(contentId: string, assetId: string) {
      return (await unwrap(client.POST('/admin/content/news/{contentId}/assets/{assetId}/scan/retry', { params: { path: { contentId, assetId } } }))).data
    },
    async createHomeBannerUpload(contentId: string, input: HomeBannerUploadInput, idempotencyKey: string, signal?: AbortSignal) {
      return (await unwrap(client.POST('/admin/content/pages/{contentId}/upload-sessions', {
        params: { path: { contentId }, header: { 'Idempotency-Key': idempotencyKey } }, body: input,
        signal,
      }))).data
    },
    async getHomeBannerStatus(contentId: string, assetId: string, signal?: AbortSignal) {
      return (await unwrap(client.GET('/admin/content/pages/{contentId}/assets/{assetId}', { params: { path: { contentId, assetId } }, signal }))).data
    },
    async retryHomeBannerScan(contentId: string, assetId: string) {
      return (await unwrap(client.POST('/admin/content/pages/{contentId}/assets/{assetId}/scan/retry', { params: { path: { contentId, assetId } } }))).data
    },
    async completeHomeBannerUpload(contentId: string, assetId: string, version: number, input: HomeBannerCompleteInput, signal?: AbortSignal) {
      return (await unwrap(client.POST('/admin/content/pages/{contentId}/assets/{assetId}/complete', {
        params: { path: { contentId, assetId }, header: { 'If-Match': `"${version}"` } }, body: input,
        signal,
      }))).data
    },
    async listPublicContent(module: Exclude<ContentModule, 'locations' | 'pages'>, locale: ContentLocale, signal?: AbortSignal) {
      return (await listPublicContentPage(module, locale, { signal })).data
    },
    listPublicContentPage,
    /** @deprecated Home v2 includes locations in getPublicPage('home', locale). */
    async listLocations(locale: ContentLocale, signal?: AbortSignal) {
      return (await unwrap(client.GET('/locations', { params: { query: { locale } }, signal }))).data
    },
    async getPublicPage(pageKey: PageKey, locale: ContentLocale, signal?: AbortSignal) {
      return (await unwrap(client.GET('/pages/{pageKey}', { params: { path: { pageKey }, query: { locale } }, signal }))).data
    },
    /** @deprecated Home v2 includes site layout links in getPublicPage('home', locale). */
    async getSiteLayout(locale: ContentLocale, signal?: AbortSignal) {
      return (await unwrap(client.GET('/site-layout', { params: { query: { locale } }, signal }))).data
    },
    async getSiteSettings(signal?: AbortSignal) {
      return (await unwrap(client.GET('/admin/site-settings', { signal }))).data
    },
    async saveSiteSettings(version: number, input: SiteSettingsWriteInput) {
      return (await unwrap(client.PUT('/admin/site-settings', {
        params: { header: { 'If-Match': `"${version}"` } }, body: input,
      }))).data
    },
    async publishSiteSettings(version: number) {
      return (await unwrap(client.POST('/admin/site-settings/publish', {
        params: { header: { 'If-Match': `"${version}"` } },
      }))).data
    },
    async unpublishSiteSettings(version: number) {
      return (await unwrap(client.POST('/admin/site-settings/unpublish', {
        params: { header: { 'If-Match': `"${version}"` } },
      }))).data
    },
    async listSiteSettingsRevisions(signal?: AbortSignal) {
      return (await unwrap(client.GET('/admin/site-settings/revisions', { signal }))).data
    },
    async restoreSiteSettingsRevision(revision: number, version: number) {
      return (await unwrap(client.POST('/admin/site-settings/revisions/{revision}/restore', {
        params: { path: { revision }, header: { 'If-Match': `"${version}"` } },
      }))).data
    },
    async getHome(locale: ContentLocale, signal?: AbortSignal) {
      return (await unwrap(client.GET('/home', { params: { query: { locale } }, signal }))).data
    },
    async getNewsBySlug(locale: ContentLocale, slug: string, signal?: AbortSignal) {
      return (await unwrap(client.GET('/news/{slug}', {
        params: { path: { slug }, query: { locale } },
        signal,
      }))).data
    },
  }
}

function apiError(response: Response, value: unknown) {
  const error = value && typeof value === 'object' && 'error' in value
    ? (value as { error?: { code?: string; message?: string; contentId?: string } }).error
    : undefined
  const meta = value && typeof value === 'object' && 'meta' in value && value.meta && typeof value.meta === 'object'
    ? value.meta as {currentVersion?: unknown; canonicalVersion?: unknown}
    : undefined
  const version = (value: unknown) => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : undefined
  return new HhcWebApiError(
    response.status,
    error?.code ?? 'request_failed',
    (error?.message ?? response.statusText) || 'Request failed.',
    typeof error?.contentId === 'string' ? error.contentId : undefined,
    {currentVersion: version(meta?.currentVersion), canonicalVersion: version(meta?.canonicalVersion)},
    response.status === 404 && error?.code === 'not_found' && response.headers.get('X-HHC-Bulletin-Access') === 'unavailable',
  )
}

export type HhcWebClient = ReturnType<typeof createHhcWebClient>

async function readBoundedBytes(response: Response, stream: ReadableStream<Uint8Array>, maximum: number): Promise<Uint8Array<ArrayBuffer>> {
  const invalid = () => new HhcWebApiError(response.status, 'invalid_response', 'The response bytes are invalid.')
  const length = response.headers.get('Content-Length')
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > maximum)) {
    await stream.cancel()
    throw invalid()
  }
  const reader = stream.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    for (;;) {
      const chunk = await reader.read()
      if (chunk.done) break
      size += chunk.value.byteLength
      if (size > maximum) { await reader.cancel(); throw invalid() }
      chunks.push(chunk.value)
    }
  } finally { reader.releaseLock() }
  if (length !== null && Number(length) !== size) throw invalid()
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
  return bytes
}

function absoluteBaseUrl(value: string) {
  const base = value.replace(/\/$/, '')
  if (/^https?:\/\//.test(base)) return base
  const origin = globalThis.location?.origin ?? 'http://localhost'
  return new URL(base || '/', origin).toString().replace(/\/$/, '')
}
