import type { ContentItem, HhcWebClient, HomePageWriteInputV2, PageContent, PageKey, PageWriteInput, PublicationContentModule } from '../src/client.js'

type Assert<T extends true> = T
type IsRequired<T, K extends keyof T> = {} extends Pick<T, K> ? false : true
type PublicPageKey = Parameters<HhcWebClient['getPublicPage']>[0]
type CreateModule = Parameters<HhcWebClient['createContent']>[0]
type DeleteModule = Parameters<HhcWebClient['deleteContent']>[0]
type ListModule = Parameters<HhcWebClient['listContent']>[0]
type PublishModule = Parameters<HhcWebClient['publishContent']>[0]
type RestoreModule = Parameters<HhcWebClient['restoreContentRevision']>[0]

type _PublicPageKeyIsFixed = Assert<PublicPageKey extends PageKey ? PageKey extends PublicPageKey ? true : false : false>
type _UnsupportedPageKeyRejected = Assert<'other' extends PublicPageKey ? false : true>
type _PageKeyRequired = Assert<IsRequired<PageWriteInput, 'pageKey'>>
type _PageTemplateRequired = Assert<IsRequired<PageWriteInput, 'pageTemplate'>>
type _RoutePathRequired = Assert<IsRequired<PageWriteInput, 'routePath'>>
type _BodyJsonRequired = Assert<IsRequired<PageWriteInput['translations'][number], 'bodyJson'>>
type _GenericCreateRejectsPages = Assert<'pages' extends CreateModule ? false : true>
type _GenericDeleteRejectsPages = Assert<'pages' extends DeleteModule ? false : true>
type _GenericListAcceptsPages = Assert<'pages' extends ListModule ? true : false>
type _GenericPublishAcceptsPages = Assert<'pages' extends PublishModule ? true : false>
type _GenericRestoreAcceptsPages = Assert<'pages' extends RestoreModule ? true : false>
type _PublicationTypeAcceptsNews = Assert<'news' extends PublicationContentModule ? true : false>
type _PublicationTypeRejectsHistory = Assert<'history' extends PublicationContentModule ? false : true>
type _PublicationTypeRejectsVideos = Assert<'videos' extends PublicationContentModule ? false : true>

declare const client: HhcWebClient
client.publishContent('pages', 'page-1', 1)
client.publishContent('news', 'news-1', 1)
// @ts-expect-error History publication is owned by its parent About Page.
client.publishContent('history', 'history-1', 1)
// @ts-expect-error Video publication is owned by its parent Home Page.
client.unpublishContent('videos', 'video-1', 1)
// @ts-expect-error History restore is owned by its parent About Page revision.
client.restoreContentRevision('history', 'history-1', 1, 1)
// @ts-expect-error Video restore is owned by its parent Home Page revision.
client.restoreContentRevision('videos', 'video-1', 1, 1)

declare const page: PageContent
if (page.template === 'home.v1') {
  page.data.weeklyTitle satisfies string
  // @ts-expect-error legal-only field must not survive home narrowing
  page.data.updatedAt
}
if (page.template === 'home.v2') {
  page.data.kingdomJoyDescription satisfies string
  // @ts-expect-error home.v1-only fields must not survive home.v2 narrowing
  page.data.weeklyTitle
}

declare const homeV2: HomePageWriteInputV2
homeV2.pageKey satisfies 'home'
homeV2.pageTemplate satisfies 'home.v2'
homeV2.routePath satisfies '/'
homeV2.translations[0]!.bodyJson.data.aboutDescription satisfies string
// @ts-expect-error removed Home v1 fields are not accepted by the Home v2 write contract
homeV2.translations[0]!.bodyJson.data.newsTitle
// @ts-expect-error projection-only fields are not accepted in Home v2 draft translations
homeV2.translations[0]!.bodyJson.data.bannerImageUrl

declare const content: ContentItem
content.translations[0]!.title.toUpperCase()
