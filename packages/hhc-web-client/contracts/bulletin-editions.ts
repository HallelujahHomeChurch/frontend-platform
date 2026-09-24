import type { bulletinEditions } from '../../preferences/src/index.js'
import type { BulletinEdition, BulletinTranslationTargetEdition, HhcWebClient } from '../src/client.js'
import type { components } from '../src/generated.js'

type Assert<T extends true> = T
type SharedEdition = (typeof bulletinEditions)[number]
type GeneratedSeries = components['schemas']['BulletinSeries']
type GeneratedLocale = components['schemas']['BulletinLocale']

type _GeneratedSeriesAreComplete = Assert<GeneratedSeries extends 'general' | 'children' ? true : false>
type _AllSeriesAreGenerated = Assert<'general' | 'children' extends GeneratedSeries ? true : false>
type _GeneratedLocalesAreComplete = Assert<GeneratedLocale extends 'zh-Hant' | 'zh-Hans' | 'en' ? true : false>
type _AllLocalesAreGenerated = Assert<'zh-Hant' | 'zh-Hans' | 'en' extends GeneratedLocale ? true : false>
type _SharedAcceptsEveryClientEdition = Assert<BulletinEdition extends SharedEdition ? true : false>
type _ClientAcceptsEverySharedEdition = Assert<SharedEdition extends BulletinEdition ? true : false>
type _ChildrenRejectsSimplifiedChinese = Assert<{series: 'children'; locale: 'zh-Hans'} extends BulletinEdition ? false : true>

type ClientEdition = Parameters<HhcWebClient['updateBulletinVersion']>[1]
type _AdminClientUsesCompositeEdition = Assert<ClientEdition extends BulletinEdition ? true : false>

type ExpectedTranslationTarget = 'zh-Hans' | 'en'
type _TranslationTargetsAreEditions = Assert<BulletinTranslationTargetEdition extends ExpectedTranslationTarget ? true : false>
type _EveryBulletinTargetIsAvailable = Assert<ExpectedTranslationTarget extends BulletinTranslationTargetEdition ? true : false>
