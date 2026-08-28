import type { ContentWriteInput, HhcWebClient, LocationWriteInput } from '../src/client.js'

type Assert<T extends true> = T
type IsRequired<T, K extends keyof T> = {} extends Pick<T, K> ? false : true
type LocationTranslation = LocationWriteInput['translations'][number]
type LegacyPublicModule = Parameters<HhcWebClient['listPublicContent']>[0]

type _LocationInputFieldsOnly = Assert<keyof LocationWriteInput extends 'locationKey' | 'mapHref' | 'sortOrder' | 'translations' ? true : false>
type _LocationKeyRequired = Assert<IsRequired<LocationWriteInput, 'locationKey'>>
type _MapHrefRequired = Assert<IsRequired<LocationWriteInput, 'mapHref'>>
type _SortOrderRequired = Assert<IsRequired<LocationWriteInput, 'sortOrder'>>
type _TranslationsRequired = Assert<IsRequired<LocationWriteInput, 'translations'>>
type _LocationTranslationFieldsOnly = Assert<keyof LocationTranslation extends 'locale' | 'title' | 'body' ? true : false>
type _LocationBodyRequired = Assert<IsRequired<LocationTranslation, 'body'>>
type _GenericLocationKeyRemainsOptional = Assert<IsRequired<ContentWriteInput, 'locationKey'> extends false ? true : false>
type _LegacyContentRejectsLocations = Assert<'locations' extends LegacyPublicModule ? false : true>
