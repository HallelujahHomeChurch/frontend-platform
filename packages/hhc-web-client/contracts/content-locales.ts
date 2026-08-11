import type { contentLocales } from '../../preferences/src/index.js'
import type { ContentTranslationTargetLocale, HhcWebClient } from '../src/client.js'
import type { components } from '../src/generated.js'

type Assert<T extends true> = T
type GeneratedLocale = components['schemas']['ContentLocale']
type SharedLocale = (typeof contentLocales)[number]

type _GeneratedAcceptsEverySharedLocale = Assert<SharedLocale extends GeneratedLocale ? true : false>
type _SharedLocalesAcceptEveryGeneratedLocale = Assert<GeneratedLocale extends SharedLocale ? true : false>

type _ContentAcceptsJapanese = Assert<'ja' extends GeneratedLocale ? true : false>
type _ContentAcceptsKorean = Assert<'ko' extends GeneratedLocale ? true : false>

type ClientLocale = Parameters<HhcWebClient['getHome']>[0]
type _ClientAcceptsEverySharedLocale = Assert<SharedLocale extends ClientLocale ? true : false>
type _SharedLocalesAcceptEveryClientLocale = Assert<ClientLocale extends SharedLocale ? true : false>

type ExpectedTranslationTarget = 'zh-Hans' | 'en' | 'ja' | 'ko'
type _TranslationTargetsAreContentLocales = Assert<ContentTranslationTargetLocale extends ExpectedTranslationTarget ? true : false>
type _EveryContentTargetIsAvailable = Assert<ExpectedTranslationTarget extends ContentTranslationTargetLocale ? true : false>
