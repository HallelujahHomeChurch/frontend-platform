import type { ContentItem, HhcWebClient, PageContent, PageKey, PageWriteInput } from '../src/client.js'

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

declare const page: PageContent
if (page.template === 'home.v1') {
  page.data.weeklyTitle satisfies string
  // @ts-expect-error legal-only field must not survive home narrowing
  page.data.updatedAt
}

declare const content: ContentItem
content.translations[0]!.title.toUpperCase()
